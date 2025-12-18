'use client';

import { FlightDetails } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface FlightCardProps {
    flight: FlightDetails;
}

export default function FlightCard({ flight }: FlightCardProps) {
    // Format helpers
    const formatTime = (ts: any) => {
        if (!ts) return '';
        if (typeof ts === 'string') return ts.split('T')[1]?.slice(0, 5) || ts;

        let date: Date;
        if (ts.seconds !== undefined) {
            date = new Date(ts.seconds * 1000);
        } else if (typeof ts.toDate === 'function') {
            date = ts.toDate();
        } else {
            date = new Date(ts);
        }

        if (isNaN(date.getTime())) return 'Invalid Time';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div className="flex gap-4 group">
            <div className="flex flex-col items-center">
                {/* Plane Icon Marker */}
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mt-1 relative z-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                </div>
                <div className="w-0.5 bg-gray-100 dark:bg-gray-700 flex-1 my-1 group-last:hidden"></div>
            </div>

            <div className="flex-1 pb-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{flight.airline}</span>
                            <span className="text-gray-400 text-sm">{flight.flightNumber}</span>
                        </div>
                        {flight.bookingReference && (
                            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                REF: {flight.bookingReference}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-8">
                        {/* Departure */}
                        <div className="flex-1">
                            <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                                {flight.departureAirportCode}
                            </div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {formatTime(flight.departureTime)}
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center flex-1">
                            <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700 relative">
                                <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-gray-300 dark:border-gray-600 rotate-45"></div>
                            </div>
                            <span className="text-xs text-gray-400 mt-1">Direct</span>
                        </div>

                        {/* Arrival */}
                        <div className="flex-1 text-right">
                            <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                                {flight.arrivalAirportCode}
                            </div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {formatTime(flight.arrivalTime)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
