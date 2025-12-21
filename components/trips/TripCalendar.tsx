'use client';

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday } from 'date-fns';
import { Trip, DayPlan } from '@/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TripCalendarProps {
    trip: Trip;
    onDayClick: (dayId: string) => void;
    selectedDayId?: string | null;
    children?: React.ReactNode;
}

export default function TripCalendar({ trip, onDayClick, selectedDayId, children }: TripCalendarProps) {
    const getDate = (date: unknown): Date => {
        if (!date) return new Date();
        if (date instanceof Date) return date;
        if (typeof date === 'object' && date !== null) {
            const d = date as Record<string, unknown>;
            if (typeof d.toDate === 'function') {
                return (d.toDate as () => Date)();
            }
            if (typeof d.seconds === 'number') {
                return new Date(d.seconds * 1000);
            }
        }
        if (typeof date === 'string') return new Date(date);
        return new Date();
    };

    const [currentMonth, setCurrentMonth] = useState(() => {
        if (trip.startDate) {
            return startOfMonth(getDate(trip.startDate));
        }
        return startOfMonth(new Date());
    });

    // Normalize trip days for easy lookup
    const processedDays = useMemo(() => {
        if (!trip.days) return {};
        const map: Record<string, DayPlan> = {};
        trip.days.forEach(day => {
            const date = getDate(day.date);
            const key = format(date, 'yyyy-MM-dd');
            map[key] = day;
        });
        return map;
    }, [trip.days]);

    const daysInMonth = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const handlePrevMonth = () => setCurrentMonth((prev: Date) => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentMonth((prev: Date) => addMonths(prev, 1));

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="w-full h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <div className="max-w-md mx-auto min-h-screen p-4 pb-24">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                    <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 mb-4">
                        {weekDays.map(day => (
                            <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                        {daysInMonth.map((date) => {
                            const dateKey = format(date, 'yyyy-MM-dd');
                            const dayPlan = processedDays[dateKey];
                            const isCurrentMonth = isSameMonth(date, currentMonth);
                            const isTodayDate = isToday(date);
                            const hasActivities = dayPlan?.activities && dayPlan.activities.length > 0;
                            const hasStay = dayPlan?.accommodation;
                            const hasTransport = dayPlan?.transportation && dayPlan.transportation.length > 0;

                            return (
                                <div key={date.toISOString()} className={`flex flex-col items-center gap-1 ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                                    <button
                                        onClick={() => {
                                            if (dayPlan) {
                                                onDayClick(dayPlan.id);
                                            }
                                        }}
                                        disabled={!dayPlan}
                                        className={`
                                            relative w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-all
                                            ${dayPlan?.id === selectedDayId ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 z-10' : ''}
                                            ${isTodayDate && dayPlan?.id !== selectedDayId ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold' : ''}
                                            ${dayPlan && dayPlan?.id !== selectedDayId ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : ''}
                                            ${dayPlan ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600 cursor-default'}
                                            ${dayPlan ? 'ring-1 ring-inset ring-gray-100 dark:ring-gray-700' : ''}
                                        `}
                                    >
                                        {format(date, 'd')}

                                        {/* Indicators */}
                                        <div className="absolute bottom-1.5 flex gap-0.5">
                                            {hasActivities && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                                            {hasStay && <div className="w-1 h-1 rounded-full bg-purple-500" />}
                                            {hasTransport && <div className="w-1 h-1 rounded-full bg-cyan-500" />}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Minimal Key */}
                <div className="mt-3 flex flex-wrap justify-center gap-4 px-2 text-[10px] text-gray-400 font-medium select-none">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Activity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>Stay</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        <span>Transport</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>Today</span>
                    </div>
                </div>

                {/* Selected Day Content */}
                {children && (
                    <div className="mt-8 animate-slide-up">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
