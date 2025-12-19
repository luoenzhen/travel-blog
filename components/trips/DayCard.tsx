'use client';

import { DayPlan, Activity, AccommodationDetails, TransportationDetails } from '@/types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import TransportCard from './TransportCard';
import AccommodationCard from './AccommodationCard';
import { useTripStore } from '@/store/tripStore';
import Image from 'next/image';
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
    const dateObj = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);

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

    return (
        <div
            id={`day-${day.id}`}
            className={`rounded-2xl p-4 sm:p-6 shadow-sm border-2 h-full transition-all duration-300 scroll-mt-20 sm:scroll-mt-32 ${isToday
                ? 'border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-500/10 scale-[1.01] bg-white dark:bg-gray-800'
                : customColor
                    ? 'border-transparent'
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
            style={(!isToday && customColor) ? { backgroundColor: customColor } : undefined}
        >
            <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div className="relative">
                    {isToday && (
                        <div className="absolute -top-6 left-0 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30 animate-pulse tracking-wider">
                            TODAY
                        </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Day {day.dayNumber}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        {format(dateObj, 'EEEE, MMM d')}
                    </p>
                </div>
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
                            {timelineItems.map((item) => (
                                <SortableItem
                                    key={item._uniqueId}
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
                                                <div className={`rounded-xl p-2 sm:p-3 transition-all border ${item.isLocked
                                                    ? 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800'
                                                    : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md border-transparent hover:border-gray-100 dark:hover:border-gray-600 cursor-pointer'
                                                    }`}
                                                    onClick={() => !item.isLocked && onEditActivity(item as Activity)}
                                                >
                                                    <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-bold ${item.isLocked ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                                                {item.name}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onToggleActivityLock(item.id);
                                                                }}
                                                                className={`p-1 rounded-md transition-colors ${item.isLocked
                                                                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                                                    : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'
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
                                                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-600">
                                                            {item.startTime}
                                                        </span>
                                                    </div>
                                                    {item.location && (
                                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {item.location.name}
                                                        </div>
                                                    )}
                                                    {item.notes && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                                                            &quot;{item.notes}&quot;
                                                        </p>
                                                    )}
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
                        {day.photos.map((photo) => (
                            <div key={photo.id} className="group/photo relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
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
    );
}
