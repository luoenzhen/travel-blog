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
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                    </svg>
                );
            case 'train':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 2h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z M6 10h12 M9 16l3 3 3-3" />
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

            <div className="flex-1 pb-2 sm:pb-4">
                <div className={`bg-white dark:bg-gray-800 rounded-xl p-2.5 sm:p-4 border border-${color}-100 dark:border-${color}-900/30 shadow-sm hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}>
                    <div className="flex justify-between items-start mb-1.5 sm:mb-3">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-gray-100 uppercase text-xs sm:text-base">{transport.airline}</span>
                            <span className="text-gray-400 text-[10px] sm:text-sm">{transport.flightNumber}</span>
                        </div>
                        {transport.bookingReference && (
                            <span className="text-[10px] sm:text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-gray-600 dark:text-gray-300">
                                REF: {transport.bookingReference}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 md:gap-8">
                        {/* Departure */}
                        <div className="flex-1 min-w-0 w-full">
                            <div className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white mb-0 sm:mb-1">
                                {transport.departureAirportCode}
                            </div>
                            <div className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title={transport.departureAirport}>
                                {formatTime(transport.departureTime)} • {transport.departureAirport}
                            </div>
                        </div>

                        {/* Arrow/Direction Line */}
                        <div className="flex-shrink-0 w-full sm:w-48 md:w-64 lg:w-80 relative py-4 sm:py-0">
                            <div className="w-full h-[1.5px] bg-gray-100 dark:bg-gray-800/50 relative flex items-center justify-center">
                                {/* Animation Container - This contains the moving elements and handles clipping */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-full">
                                    {/* Animated Traveling Element (Light pulse) */}
                                    <div
                                        className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-current to-transparent animate-travel-line opacity-40"
                                        style={{ color: `var(--${color === 'emerald' ? 'green' : color}-500)` }}
                                    ></div>

                                    {/* The Moving Dot (Plane/Train head) */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-travel-line z-10"
                                        style={{
                                            backgroundColor: `var(--${color === 'emerald' ? 'green' : color}-500)`,
                                            boxShadow: `0 0 10px var(--${color === 'emerald' ? 'green' : color}-500)`,
                                            animationDelay: '0.1s'
                                        }}
                                    ></div>
                                </div>

                                {/* The Arrowhead - Outside overflow container to prevent tip clipping */}
                                <div className="absolute -right-1 -top-[4px] w-2.5 h-2.5 border-t-2 border-r-2 border-gray-400 dark:border-gray-500 rotate-45 z-20"></div>

                                {/* Transport Type Badge - On top of everything */}
                                <div className="absolute top-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-3 py-1 sm:px-12 sm:py-4 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center shadow-xl z-30 hover:scale-110 transition-transform cursor-default min-w-[70px] sm:min-w-[180px]">
                                    <span className="text-[10px] sm:text-[24px] font-black uppercase tracking-wider sm:tracking-[0.2em] leading-none text-center" style={{ color: `var(--${color === 'emerald' ? 'green' : color}-600)` }}>
                                        {transport.type}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Arrival */}
                        <div className="flex-1 min-w-0 w-full text-left sm:text-right">
                            <div className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white mb-0 sm:mb-1">
                                {transport.arrivalAirportCode}
                            </div>
                            <div className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title={transport.arrivalAirport}>
                                {formatTime(transport.arrivalTime)} • {transport.arrivalAirport}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
