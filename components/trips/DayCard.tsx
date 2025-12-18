'use client';

import { DayPlan, Activity, AccommodationDetails, TransportationDetails } from '@/types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import TransportCard from './TransportCard';
import AccommodationCard from './AccommodationCard';
import { useTripStore } from '@/store/tripStore';
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
    onEditTransport?: (transport: TransportationDetails) => void;
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: (isDragging ? 'relative' : 'static') as any,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none group">
            <div className={`transition-all duration-200 ${isDragging ? 'scale-[1.02] shadow-xl ring-2 ring-primary-500/20' : ''}`}>
                {children}
            </div>
        </div>
    );
}

export default function DayCard({ day, onAddActivity, onEditTransport }: DayCardProps) {
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
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Helper to normalize any time format to HH:mm (24h) for sorting
    const to24h = (time: any) => {
        if (!time) return '00:00';

        // Handle Firebase Timestamp or Date objects (Transportation)
        if (typeof time === 'object') {
            let date: Date;
            if (time.seconds !== undefined) {
                date = new Date(time.seconds * 1000);
            } else if (typeof time.toDate === 'function') {
                date = time.toDate();
            } else {
                date = new Date(time);
            }
            if (isNaN(date.getTime())) return '00:00';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        // Handle string formats like "10:00 AM" or "3:00 PM" (Activities, Stays)
        if (typeof time === 'string') {
            const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (!match) return time; // Already HH:mm potentially

            let [_, hours, minutes, modifier] = match;
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
        ...(day.transportation || []).map(f => ({ ...f, _type: 'transportation', _uniqueId: f.id, _sortTime: to24h(f.departureTime) })),
        ...(day.activities || []).map(a => ({ ...a, _type: 'activity', _uniqueId: a.id, _sortTime: to24h(a.startTime) })),
        ...(day.accommodationCheckout ? [{ ...day.accommodationCheckout, _type: 'stay-checkout', _uniqueId: `checkout-${day.accommodationCheckout.id}`, _sortTime: to24h(day.accommodationCheckout.checkOutTime) }] : []),
    ];

    if (day.accommodation) {
        rawItems.push({
            ...day.accommodation,
            _type: 'stay',
            _uniqueId: `stay-${day.accommodation.id}`,
            _sortTime: isCheckInDay ? to24h(day.accommodation.checkInTime) : '15:00'
        });
    }

    // Sort items
    let timelineItems: any[];
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

    return (
        <div
            className={`rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full ${customColor ? '' : 'bg-white dark:bg-gray-800'}`}
            style={customColor ? { backgroundColor: customColor } : undefined}
        >
            <div className="flex justify-between items-start mb-6">
                <div>
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
                </div>
            </div>

            <div className="space-y-4">
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
                            {timelineItems.map((item: any) => (
                                <SortableItem key={item._uniqueId} id={item._uniqueId}>
                                    {item._type === 'transportation' ? (
                                        <TransportCard
                                            transport={item}
                                            onClick={onEditTransport ? () => onEditTransport(item) : undefined}
                                        />
                                    ) : item._type === 'stay' || item._type === 'stay-checkout' ? (
                                        <AccommodationCard
                                            accommodation={item}
                                            isCheckIn={item._type === 'stay' && isCheckInDay}
                                            isCheckOut={item._type === 'stay-checkout'}
                                        />
                                    ) : (
                                        <div className="flex gap-4 group/activity">
                                            <div className="flex flex-col items-center">
                                                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                                                <div className="w-0.5 bg-gray-100 dark:bg-gray-700 flex-1 my-1 last:hidden"></div>
                                            </div>
                                            <div className="flex-1 pb-4">
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-600">
                                                            {item.startTime}
                                                        </span>
                                                    </div>
                                                    {item.location && (
                                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {item.location.name}
                                                        </div>
                                                    )}
                                                    {item.notes && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                                                            "{item.notes}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
        </div>
    );
}
