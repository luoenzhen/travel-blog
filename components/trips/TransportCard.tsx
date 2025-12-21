'use client';

import { TransportationDetails } from '@/types';
import { Timestamp } from 'firebase/firestore';


interface TransportCardProps {
    transport: TransportationDetails;
    onClick?: () => void;
    onLocationClick?: (location: string) => void;
}

export default function TransportCard({ transport, onClick, onLocationClick }: TransportCardProps) {
    // Format helpers
    const formatTime = (ts: string | { seconds: number } | { toDate: () => Date } | Date | null | undefined) => {
        if (!ts) return '';
        if (typeof ts === 'string') return ts.split('T')[1]?.slice(0, 5) || ts;

        let date: Date;
        if (ts && typeof ts === 'object' && 'seconds' in ts) {
            date = new Date((ts as { seconds: number }).seconds * 1000);
        } else if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
            date = (ts as { toDate: () => Date }).toDate();
        } else {
            date = new Date(ts as string | number | Date);
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
        <div className="w-full pb-2 sm:pb-4 group" onClick={onClick}>
            <div className={`bg-white dark:bg-gray-800 rounded-xl p-2 sm:p-3 border border-${color}-100 dark:border-${color}-900/30 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700' : ''}`}>
                <div className="flex flex-row justify-between items-center gap-1 sm:mb-2 mb-1">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 dark:text-gray-100 uppercase text-[9px] sm:text-sm">{transport.airline}</span>
                        <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-${color}-50 dark:bg-${color}-900/20 flex items-center justify-center text-${color}-600 dark:text-${color}-400 flex-shrink-0`}>
                            <div className="scale-75 sm:scale-90">
                                {getIcon()}
                            </div>
                        </div>
                        <span className="text-gray-400 text-[8px] sm:text-xs">{transport.flightNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {transport.bookingReference && (
                            <span className="text-[8px] sm:text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-gray-600 dark:text-gray-300">
                                REF: {transport.bookingReference}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-row items-center gap-2 sm:gap-4 md:gap-6">
                    {/* Departure */}
                    <div className="flex-1 min-w-0 text-left">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const loc = transport.departureAirport || transport.departureAirportCode;
                                if (loc) onLocationClick?.(loc);
                            }}
                            className="inline-block hover:text-primary-500 transition-colors group/dep"
                        >
                            <div className="text-base sm:text-xl font-black text-gray-900 dark:text-white leading-tight flex items-center justify-start gap-1">
                                {transport.departureAirportCode}
                                <svg className="w-3 h-3 opacity-0 group-hover/dep:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        </button>
                        <div className="text-[9px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate" title={transport.departureAirport}>
                            {formatTime(transport.departureTime)}
                        </div>
                    </div>

                    {/* Arrow/Direction Line */}
                    <div className="flex-shrink-0 w-20 sm:w-40 md:w-56 lg:w-72 relative">
                        <div className="w-full h-[1px] bg-gray-100 dark:bg-gray-800/50 relative flex items-center justify-center">
                            {/* Animation Container */}
                            <div className="absolute inset-x-0 -inset-y-4 overflow-hidden pointer-events-none rounded-full">
                                {(() => {
                                    const getAsDate = (ts: Timestamp | { seconds: number } | string | Date | null | undefined): Date | null => {
                                        if (!ts) return null;
                                        if (typeof ts === 'object' && 'seconds' in ts) {
                                            return new Date((ts as { seconds: number }).seconds * 1000);
                                        } else if (typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
                                            return (ts as { toDate: () => Date }).toDate();
                                        } else {
                                            const date = new Date(ts as string | Date);
                                            return isNaN(date.getTime()) ? null : date;
                                        }
                                    };

                                    const departureDate = getAsDate(transport.departureTime);
                                    const arrivalDate = getAsDate(transport.arrivalTime);
                                    const now = new Date();
                                    const isLive = departureDate && arrivalDate && now >= departureDate && now <= arrivalDate;

                                    if (!isLive) return null;

                                    if (transport.type === 'flight') {
                                        return (
                                            <div className="absolute top-1/2 -translate-y-1/2 animate-flight-move opacity-40 text-blue-500">
                                                <svg className="w-6 h-6 rotate-90 fill-current" viewBox="0 0 24 24">
                                                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                                </svg>
                                            </div>
                                        );
                                    }

                                    if (transport.type === 'train') {
                                        return (
                                            <div className="absolute top-1/2 -translate-y-1/2 animate-train-move opacity-40 text-emerald-500 flex items-center">
                                                {/* Long train shape */}
                                                <div className="w-12 h-2.5 bg-current rounded-l-sm flex items-center justify-around px-1 gap-0.5">
                                                    <div className="w-1.5 h-1 bg-white/40 rounded-sm"></div>
                                                    <div className="w-1.5 h-1 bg-white/40 rounded-sm"></div>
                                                    <div className="w-1.5 h-1 bg-white/40 rounded-sm"></div>
                                                    <div className="w-1.5 h-1 bg-white/40 rounded-sm"></div>
                                                </div>
                                                <div className="w-3 h-3 bg-current rounded-r-md -ml-0.5 relative">
                                                    <div className="absolute right-0.5 top-0.5 w-1 h-1.5 bg-white/40 rounded-sm"></div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            <div
                                                className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-current to-transparent animate-travel-line opacity-30"
                                                style={{ color: `var(--${color === 'emerald' ? 'green' : color}-500)` }}
                                            ></div>
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full animate-travel-line z-10"
                                                style={{
                                                    backgroundColor: `var(--${color === 'emerald' ? 'green' : color}-500)`,
                                                    boxShadow: `0 0 8px var(--${color === 'emerald' ? 'green' : color}-500)`,
                                                    animationDelay: '0.1s'
                                                }}
                                            ></div>
                                        </>
                                    );
                                })()}
                            </div>


                            {/* Arrowhead */}
                            <div className="absolute right-0 -top-[3.5px] w-2 h-2 border-t-[1.5px] border-r-[1.5px] border-gray-400 dark:border-gray-500 rotate-45 z-20"></div>

                            {/* Transport Type Badge - Made thinner */}
                            <div className="absolute top-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-2.5 py-0.5 sm:px-8 sm:py-2 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center shadow-lg z-30 hover:scale-105 transition-transform cursor-default min-w-[60px] sm:min-w-[140px]">
                                <span className="text-[9px] sm:text-[16px] font-black uppercase tracking-wider sm:tracking-[0.15em] leading-none text-center" style={{ color: `var(--${color === 'emerald' ? 'green' : color}-600)` }}>
                                    {transport.type}
                                </span>
                            </div>
                        </div>
                    </div>


                    {/* Arrival */}
                    <div className="flex-1 min-w-0 text-right">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const loc = transport.arrivalAirport || transport.arrivalAirportCode;
                                if (loc) onLocationClick?.(loc);
                            }}
                            className="inline-block hover:text-primary-500 transition-colors group/arr"
                        >
                            <div className="text-base sm:text-xl font-black text-gray-900 dark:text-white leading-tight flex items-center justify-end gap-1">
                                <svg className="w-3 h-3 opacity-0 group-hover/arr:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {transport.arrivalAirportCode}
                            </div>
                        </button>
                        <div className="text-[9px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate" title={transport.arrivalAirport}>
                            {formatTime(transport.arrivalTime)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
