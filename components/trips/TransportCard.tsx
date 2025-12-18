'use client';

import { TransportationDetails } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface TransportCardProps {
    transport: TransportationDetails;
    onClick?: () => void;
}

export default function TransportCard({ transport, onClick }: TransportCardProps) {
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

    const getIcon = () => {
        switch (transport.type) {
            case 'flight':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                );
            case 'train':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L8 6v13l4 3 4-3V6l-4-4zM8 6h8" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v4M9 18l3 2 3-2M8 10h8" />
                    </svg>
                );
            case 'bus':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-9 8h10M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                        <circle cx="7" cy="17" r="1" />
                        <circle cx="17" cy="17" r="1" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                );
        }
    };

    const getTypeColor = () => {
        switch (transport.type) {
            case 'flight': return 'blue';
            case 'train': return 'emerald';
            case 'bus': return 'orange';
            default: return 'gray';
        }
    };

    const color = getTypeColor();

    return (
        <div className="flex gap-4 group" onClick={onClick}>
            <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center text-${color}-600 dark:text-${color}-400 mt-1 relative z-10`}>
                    {getIcon()}
                </div>
                <div className="w-0.5 bg-gray-100 dark:bg-gray-700 flex-1 my-1 group-last:hidden"></div>
            </div>

            <div className="flex-1 pb-4">
                <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-${color}-100 dark:border-${color}-900/30 shadow-sm hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{transport.airline}</span>
                            <span className="text-gray-400 text-sm">{transport.flightNumber}</span>
                        </div>
                        {transport.bookingReference && (
                            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                REF: {transport.bookingReference}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-8">
                        {/* Departure */}
                        <div className="flex-1">
                            <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                                {transport.departureAirportCode}
                            </div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={transport.departureAirport}>
                                {formatTime(transport.departureTime)} • {transport.departureAirport}
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center flex-1">
                            <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700 relative">
                                <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-gray-300 dark:border-gray-600 rotate-45"></div>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 capitalize">{transport.type}</span>
                        </div>

                        {/* Arrival */}
                        <div className="flex-1 text-right">
                            <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                                {transport.arrivalAirportCode}
                            </div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={transport.arrivalAirport}>
                                {formatTime(transport.arrivalTime)} • {transport.arrivalAirport}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
