'use client';

import { DayPlan, Activity, AccommodationDetails, TransportationDetails } from '@/types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import TransportCard from './TransportCard';
import AccommodationCard from './AccommodationCard';
import { useTripStore } from '@/store/tripStore';
import Image from 'next/image';
import { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    TouchSensor,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DayCardProps {
    day: DayPlan;
    onAddActivity: () => void;
    onEditActivity: (activity: Activity) => void;
    onToggleActivityLock: (activityId: string) => void;
    onAddPhoto?: () => void;
    onRemovePhoto?: (photoId: string) => void;
}

function SortableItem({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: (isDragging ? 'relative' : 'static') as 'relative' | 'static',
    };

    return (
        <div ref={setNodeRef} style={style} className="group relative flex items-start gap-1 sm:gap-2">
            {/* Drag Handle */}
            {!disabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className="mt-4 p-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary-500 dark:text-gray-600 dark:hover:text-primary-400 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50"
                    title="Drag to reorder"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-12a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                    </svg>
                </div>
            )}
            {disabled && <div className="w-6" />}

            <div className={`flex-1 transition-all duration-200 ${isDragging ? 'scale-[1.02] shadow-xl ring-2 ring-primary-500/20' : ''}`}>
                {children}
            </div>
        </div>
    );
}

export default function DayCard({ day, onAddActivity, onEditActivity, onToggleActivityLock, onAddPhoto, onRemovePhoto }: DayCardProps) {
    const updateDayOrder = useTripStore(state => state.updateDayOrder);
    const [hoveredImage, setHoveredImage] = useState<string | null>(null);
    const dateObj = (day.date as any)?.toDate ? (day.date as any).toDate() :
        (day.date as any)?.seconds ? new Date((day.date as any).seconds * 1000) :
            new Date(day.date as any);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 0,
                tolerance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    type TimelineItem =
        | (TransportationDetails & { _type: 'transportation'; _uniqueId: string; _sortTime: string })
        | (Activity & { _type: 'activity'; _uniqueId: string; _sortTime: string })
        | (AccommodationDetails & { _type: 'stay' | 'stay-checkout'; _uniqueId: string; _sortTime: string });

    // Helper to normalize any time format to HH:mm (24h) for sorting
    const to24h = (time: string | Timestamp | Date | { seconds: number } | unknown) => {
        if (!time) return '00:00';

        // Handle Firebase Timestamp or Date objects (Transportation)
        if (typeof time === 'object' && time !== null) {
            let date: Date;
            if ('seconds' in time) {
                date = new Date((time as { seconds: number }).seconds * 1000);
            } else if ('toDate' in time && typeof (time as { toDate: () => Date }).toDate === 'function') {
                date = (time as { toDate: () => Date }).toDate();
            } else {
                date = new Date(time as string | number | Date);
            }
            if (isNaN(date.getTime())) return '00:00';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        // Handle string formats like "10:00 AM" or "3:00 PM" (Activities, Stays)
        if (typeof time === 'string') {
            const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (!match) return time; // Already HH:mm potentially

            const [, hours, minutes, modifier] = match;
            let h = parseInt(hours, 10);
            if (modifier) {
                if (modifier.toUpperCase() === 'PM' && h < 12) h += 12;
                if (modifier.toUpperCase() === 'AM' && h === 12) h = 0;
            }
            return `${h.toString().padStart(2, '0')}:${minutes}`;
        }

        return '00:00';
    };

    const isCheckInDay = day.accommodation && day.accommodation.checkInDate === dateObj.toISOString().split('T')[0];

    const rawItems = [
        ...(day.transportation || []).map(f => ({ ...f, _type: 'transportation', _uniqueId: f.id, _sortTime: to24h(f.departureTime) } as TimelineItem)),
        ...(day.activities || []).map(a => ({ ...a, _type: 'activity', _uniqueId: a.id, _sortTime: to24h(a.startTime) } as TimelineItem)),
        ...(day.accommodationCheckout ? [{ ...day.accommodationCheckout, _type: 'stay-checkout', _uniqueId: `checkout-${day.accommodationCheckout.id}`, _sortTime: to24h(day.accommodationCheckout.checkOutTime) } as TimelineItem] : []),
    ];

    if (day.accommodation) {
        rawItems.push({
            ...day.accommodation,
            _type: 'stay',
            _uniqueId: `stay-${day.accommodation.id}`,
            _sortTime: isCheckInDay ? to24h(day.accommodation.checkInTime) : '15:00'
        } as TimelineItem);
    }

    // Sort items
    let timelineItems: TimelineItem[];
    if (day.customOrder && day.customOrder.length > 0) {
        timelineItems = [...rawItems].sort((a, b) => {
            const indexA = day.customOrder!.indexOf(a._uniqueId);
            const indexB = day.customOrder!.indexOf(b._uniqueId);
            if (indexA === -1 && indexB === -1) return a._sortTime.localeCompare(b._sortTime);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    } else {
        timelineItems = [...rawItems].sort((a, b) => a._sortTime.localeCompare(b._sortTime));
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = timelineItems.findIndex(item => item._uniqueId === active.id);
            const newIndex = timelineItems.findIndex(item => item._uniqueId === over.id);

            const newArray = arrayMove(timelineItems, oldIndex, newIndex);
            updateDayOrder(day.tripId, day.id, newArray.map(i => i._uniqueId));
        }
    };

    const effectiveAccommodation = day.accommodation || day.accommodationCheckout;
    const customColor = effectiveAccommodation?.color && effectiveAccommodation.color !== '#ffffff' ? effectiveAccommodation.color : undefined;

    // Check if this day is "Today"
    const today = new Date();
    const isToday = today.getDate() === dateObj.getDate() &&
        today.getMonth() === dateObj.getMonth() &&
        today.getFullYear() === dateObj.getFullYear();

    const getActivityIcon = (type: string) => {
        let colorClass = 'text-primary-500';
        let icon = null;

        switch (type) {
            case 'sightseeing':
                colorClass = 'text-blue-500';
                icon = (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                );
                break;
            case 'dining':
                colorClass = 'text-orange-500';
                icon = (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v8a3 3 0 003 3h2a3 3 0 003-3V3m-4 0v3m-3 0v3m6-3v3M13 19s0 1 1 1h4s1 0 1-1V3s-6 0-6 6v10z" />
                    </svg>
                );
                break;
            case 'shopping':
                colorClass = 'text-emerald-500';
                icon = (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                );
                break;
            case 'transport':
                colorClass = 'text-cyan-500';
                icon = (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                );
                break;
            case 'entertainment':
                colorClass = 'text-purple-500';
                icon = (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                );
                break;
            default:
                colorClass = 'text-gray-500';
                icon = (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
                    </svg>
                );
        }

        return <span className={colorClass}>{icon}</span>;
    };

    const renderWeather = () => {
        if (!day.weather) return null;

        const { temp, icon, condition } = day.weather;

        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/50 dark:bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-100/50 dark:border-gray-600/50 shadow-sm transition-all hover:scale-105 group" title={condition}>
                <span className="text-xl group-hover:animate-bounce">
                    {icon === 'sunny' && '☀️'}
                    {icon === 'rainy' && '🌧️'}
                    {icon === 'cloudy' && '☁️'}
                    {icon === 'snowy' && '❄️'}
                    {icon === 'thunderstorm' && '⛈️'}
                </span>
                <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{temp}°C</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize truncate max-w-[60px] leading-tight">{condition}</span>
                </div>
            </div>
        );
    };

    const renderWeatherInsight = () => {
        if (!day.weather || !day.weather.icon.includes('rain')) return null;

        const outdoorActivities = day.activities?.filter(a => a.environment === 'outdoor' || (!a.environment && a.type === 'sightseeing')) || [];
        if (outdoorActivities.length === 0) return null;

        return (
            <div className="mt-4 mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800/50 rounded-2xl animate-fade-in relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <svg className="w-16 h-16 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="relative z-10 text-left">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="p-1 px-2 bg-amber-500 text-white text-[10px] font-black rounded-lg shadow-sm">AI INSIGHT</span>
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Weather Adaptation Needed</h4>
                    </div>
                    <p className="text-sm text-amber-800 dark:text-amber-300/80 leading-relaxed">
                        Rain is expected. Swap <strong>{outdoorActivities[0].name}</strong> with an indoor activity or move it to another day.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-amber-500/20">
                            Find Alternative
                        </button>
                        <button className="px-3 py-1.5 bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800/50 transition-colors">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            id={`day-${day.id}`}
            className={`relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-sm border-2 h-full transition-all duration-500 scroll-mt-20 sm:scroll-mt-32 ${isToday
                ? 'border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-500/10 scale-[1.01] bg-white dark:bg-gray-800'
                : customColor
                    ? 'border-transparent'
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                } ${hoveredImage ? 'border-primary-400/50 shadow-2xl scale-[1.02]' : ''}`}
            style={(!isToday && customColor) ? { backgroundColor: customColor } : undefined}
        >
            {/* Dynamic Full Card Background */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-700 pointer-events-none ${hoveredImage ? 'opacity-100' : 'opacity-0'}`}>
                {hoveredImage && (
                    <>
                        <img
                            src={hoveredImage}
                            alt="Background"
                            className="w-full h-full object-cover object-center scale-110 blur-sm brightness-50"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/20 to-black/80" />
                    </>
                )}
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <div className="relative text-left">
                        {isToday && (
                            <div className="absolute -top-6 left-0 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30 animate-pulse tracking-wider">
                                TODAY
                            </div>
                        )}
                        <h3 className={`text-lg font-bold transition-colors duration-500 ${hoveredImage ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            Day {day.dayNumber}
                        </h3>
                        <p className={`font-medium transition-colors duration-500 ${hoveredImage ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                            {format(dateObj, 'EEEE, MMM d')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {renderWeather()}
                        <div className="flex gap-2">
                            <button
                                onClick={onAddActivity}
                                className="p-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                                title="Add Activity"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            <button
                                onClick={onAddPhoto}
                                className="p-2 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                                title="Add Photo"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {renderWeatherInsight()}

                <div className="space-y-2 sm:space-y-4">
                    {timelineItems.length > 0 ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={timelineItems.map(i => i._uniqueId)}
                                strategy={verticalListSortingStrategy}
                            >
                                {timelineItems.map((item, index) => (
                                    <SortableItem
                                        key={item._uniqueId || `item-${index}`}
                                        id={item._uniqueId}
                                        disabled={item._type === 'activity' && item.isLocked}
                                    >
                                        {item._type === 'transportation' ? (
                                            <TransportCard
                                                transport={item}
                                            />
                                        ) : item._type === 'stay' || item._type === 'stay-checkout' ? (
                                            <AccommodationCard
                                                accommodation={item}
                                                isCheckIn={item._type === 'stay' && isCheckInDay}
                                                isCheckOut={item._type === 'stay-checkout'}
                                            />
                                        ) : item._type === 'activity' ? (
                                            <div className="flex gap-4 group/activity">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                                                    <div className="w-0.5 bg-gray-100 dark:bg-gray-700 flex-1 my-1 last:hidden"></div>
                                                </div>
                                                <div className="flex-1 pb-2 sm:pb-4">
                                                    <div className={`relative overflow-hidden rounded-xl transition-all border group/activity ${item.isLocked
                                                        ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                                                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md border-transparent hover:border-gray-100 dark:hover:border-gray-600 cursor-pointer'
                                                        } ${(item as Activity).imageUrl ? 'min-h-[100px]' : 'p-2 sm:p-3'}`}
                                                        onClick={() => !item.isLocked && onEditActivity(item as Activity)}
                                                        onMouseEnter={() => (item as Activity).imageUrl && setHoveredImage((item as Activity).imageUrl!)}
                                                        onMouseLeave={() => setHoveredImage(null)}
                                                    >
                                                        {/* Smart Image Background */}
                                                        {(item as Activity).imageUrl && (
                                                            <div className="absolute inset-0 z-0">
                                                                <img
                                                                    src={(item as Activity).imageUrl}
                                                                    alt={item.name}
                                                                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover/activity:scale-110"
                                                                />
                                                                {/* Multi-layered overlay for maximum contrast */}
                                                                <div className="absolute inset-0 bg-black/40 group-hover/activity:bg-black/10 transition-colors duration-300" />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20 dark:from-black/95 group-hover/activity:from-black/40 transition-colors duration-300" />
                                                            </div>
                                                        )}

                                                        <div className={`relative z-10 ${(item as Activity).imageUrl ? 'p-3 text-white' : ''}`}>
                                                            <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${item.isLocked
                                                                        ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                                                                        : (item as Activity).imageUrl
                                                                            ? 'text-white bg-blue-600/80 backdrop-blur-md border border-white/20 shadow-lg'
                                                                            : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50'
                                                                        }`}>
                                                                        <span className="flex-shrink-0 group-hover/activity:scale-110 transition-transform">
                                                                            {getActivityIcon((item as Activity).type || 'other')}
                                                                        </span>
                                                                        <span className="truncate max-w-[120px] sm:max-w-[200px]">{item.name}</span>
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onToggleActivityLock(item.id);
                                                                        }}
                                                                        className={`p-1 rounded-md transition-colors ${item.isLocked
                                                                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                                                            : (item as Activity).imageUrl ? 'text-white/40 hover:text-white bg-white/10' : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'
                                                                            }`}
                                                                        title={item.isLocked ? "Unlock Activity" : "Lock Activity"}
                                                                    >
                                                                        {item.isLocked ? (
                                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0v4M5 11h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2z" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <span className={`text-xs font-mono px-2 py-0.5 rounded-md border ${item.isLocked ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-600 text-gray-500 dark:text-gray-400' : (item as Activity).imageUrl ? 'bg-white/20 backdrop-blur-md border-white/20 text-white' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                                                                    {item.startTime}
                                                                </span>
                                                            </div>
                                                            {item.location && (
                                                                <a
                                                                    href={`https://www.bing.com/maps?q=${encodeURIComponent(item.location.name)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className={`flex items-center text-xs transition-colors mb-1 sm:mb-2 w-fit group/map ${(item as Activity).imageUrl ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-primary-500'}`}
                                                                >
                                                                    <svg className="w-3 h-3 mr-1 group-hover/map:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    </svg>
                                                                    <span>{item.location.name}</span>
                                                                    <svg className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/map:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                    </svg>
                                                                </a>
                                                            )}
                                                            {item.notes && (
                                                                <p className={`text-xs italic p-2 rounded-lg border ${item.isLocked ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30 text-gray-600 dark:text-gray-300' : (item as Activity).imageUrl ? 'bg-black/20 backdrop-blur-sm border-white/10 text-white/80' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30 text-gray-600 dark:text-gray-300'}`}>
                                                                    &quot;{item.notes}&quot;
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </SortableItem>
                                ))}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                            <p className="text-gray-400 text-sm mb-2">Empty day</p>
                            <div className="flex justify-center flex-wrap gap-3">
                                <button onClick={onAddActivity} className="text-primary-500 text-sm font-medium hover:underline">+ Add activity</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Photos Section */}
                {day.photos && day.photos.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Photos</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {day.photos.map((photo, index) => (
                                <div key={photo.id || `photo-${index}`} className="group/photo relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                                    <Image
                                        src={photo.url}
                                        alt={photo.caption || 'Trip photo'}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover/photo:scale-110"
                                        unoptimized
                                    />
                                    {photo.caption && (
                                        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-black/40 backdrop-blur-[2px]">
                                            <p className="text-xs text-white line-clamp-2 leading-tight drop-shadow-sm font-medium">
                                                {photo.caption}
                                            </p>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => onRemovePhoto?.(photo.id)}
                                        className="absolute top-1 right-1 p-1 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover/photo:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
                                        title="Remove photo"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
