'use client';

import { DayPlan, Activity, AccommodationDetails } from '@/types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import FlightCard from './FlightCard';
import AccommodationCard from './AccommodationCard';

interface DayCardProps {
    day: DayPlan;
    onAddActivity: () => void;
}

export default function DayCard({ day, onAddActivity }: DayCardProps) {
    const dateObj = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);

    const getTime = (item: any, type: 'flight' | 'activity') => {
        if (type === 'activity') return item.startTime;
        const t = item.departureTime;
        if (!t) return '';
        if (typeof t === 'string') return t.split('T')[1]?.slice(0, 5) || t;

        let date: Date;
        if (t.seconds !== undefined) {
            date = new Date(t.seconds * 1000);
        } else if (typeof t.toDate === 'function') {
            date = t.toDate();
        } else {
            date = new Date(t);
        }

        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const timelineItems = [
        ...(day.flights || []).map(f => ({ ...f, _type: 'flight' })),
        ...(day.activities || []).map(a => ({ ...a, _type: 'activity' }))
    ].sort((a, b) => {
        const timeA = getTime(a, a._type as any);
        const timeB = getTime(b, b._type as any);
        return timeA.localeCompare(timeB);
    });

    const customColor = day.accommodation?.color && day.accommodation.color !== '#ffffff' ? day.accommodation.color : undefined;

    return (
        <div
            className={`rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full ${customColor ? '' : 'bg-white dark:bg-gray-800'}`}
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

            {/* Accommodation Section (Always Top if exists) */}
            <div className="space-y-6">
                {/* 1. Checkout from previous hotel (Morning) */}
                {day.accommodationCheckout && (
                    <div className="mb-4">
                        <AccommodationCard
                            accommodation={day.accommodationCheckout}
                            isCheckOut={true}
                        />
                    </div>
                )}

                {/* 2. Check-in to new hotel (Afternoon/Night) */}
                {day.accommodation && (
                    <div className="mb-4">
                        <AccommodationCard
                            accommodation={day.accommodation}
                            isCheckIn={
                                // Only show check-in if this IS the check-in date
                                day.accommodation.checkInDate === dateObj.toISOString().split('T')[0]
                            }
                        />
                    </div>
                )}

                {/* Timeline */}
                <div className="space-y-4">
                    {timelineItems.length > 0 ? (
                        timelineItems.map((item: any) => {
                            if (item._type === 'flight') {
                                return <FlightCard key={item.id} flight={item} />;
                            } else {
                                const activity = item as Activity;
                                return (
                                    <div key={activity.id} className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                                            <div className="w-0.5 bg-gray-100 dark:bg-gray-700 flex-1 my-1 group-last:hidden"></div>
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                                        {activity.name}
                                                    </span>
                                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-600">
                                                        {activity.startTime}
                                                    </span>
                                                </div>
                                                {activity.location && (
                                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        {activity.location.name}
                                                    </div>
                                                )}
                                                {activity.notes && (
                                                    <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                                                        "{activity.notes}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        })
                    ) : (
                        (!day.accommodation && !day.accommodationCheckout) && (
                            <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                                <p className="text-gray-400 text-sm mb-2">Empty day</p>
                                <div className="flex justify-center flex-wrap gap-3">
                                    <button onClick={onAddActivity} className="text-primary-500 text-sm font-medium hover:underline">+ Add activity</button>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
