'use client';

import Image from 'next/image';
import { AccommodationDetails } from '@/types';

interface AccommodationCardProps {
    accommodation: AccommodationDetails;
    isCheckIn?: boolean;
    isCheckOut?: boolean;
    onLocationClick?: (id: string) => void;
}

export default function AccommodationCard({ accommodation, isCheckIn, isCheckOut, onLocationClick }: AccommodationCardProps) {
    // If explicit flags are not provided (default behavior), assume generic info (maybe show both or minimal)
    // Actually, logic from parent decides. If both false, it's a middle day.
    const isMiddleDay = !isCheckIn && !isCheckOut;
    return (
        <div id={`stay-${accommodation.id}`} className="pb-2 sm:pb-4 group">
            <div
                className="relative overflow-hidden rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm hover:shadow-md transition-all min-h-[120px]"
                style={{ backgroundColor: accommodation.color || '#ffffff' }}
            >
                {/* Background Image with Overlay */}
                {accommodation.imageUrl && (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={accommodation.imageUrl}
                            alt={accommodation.name}
                            fill
                            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                            unoptimized
                        />
                        {/* Multi-layered overlay for maximum contrast - Lightened */}
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
                    </div>
                )}

                <div className={`relative z-10 p-2.5 sm:p-4 h-full flex flex-col justify-between ${accommodation.imageUrl ? 'text-white drop-shadow-lg' : ''}`}>
                    <div className="flex justify-between items-start mb-1 sm:mb-2 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${accommodation.imageUrl ? 'bg-white/20 backdrop-blur-md text-white' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10V6a2 2 0 012-2h14a2 2 0 012 2v4M3 20v-8a2 2 0 012-2h14a2 2 0 012 2v8M3 14h18M12 4v6" />
                                </svg>
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm sm:text-base leading-tight ${accommodation.imageUrl ? 'text-white drop-shadow-md' : 'text-gray-900 dark:text-gray-100'}`}>{accommodation.name}</h4>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onLocationClick?.(accommodation.id);
                                    }}
                                    className={`text-[10px] sm:text-sm transition-colors flex items-center gap-1 group/addr ${accommodation.imageUrl ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-purple-500'}`}
                                >
                                    <span className="truncate max-w-[150px] sm:max-w-[250px]">{accommodation.address}</span>
                                    <svg className="w-2.5 h-2.5 opacity-0 group-hover/addr:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <span className={`text-[10px] sm:text-xs font-medium uppercase tracking-wide px-1.5 py-0.5 sm:px-2 sm:py-1 rounded flex-shrink-0 ${accommodation.imageUrl ? 'bg-white/20 backdrop-blur-md text-white' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'}`}>
                            {accommodation.type}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2 sm:mt-3 text-[11px] sm:text-sm">
                        {(isCheckIn) && (
                            <div className={`flex items-center ${accommodation.imageUrl ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'}`}>
                                <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${accommodation.imageUrl ? 'text-white/60' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                In: <span className="font-medium ml-1">{accommodation.checkInTime}</span>
                            </div>
                        )}
                        {(isCheckOut) && (
                            <div className={`flex items-center ${accommodation.imageUrl ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'}`}>
                                <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${accommodation.imageUrl ? 'text-white/60' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                Out: <span className="font-medium ml-1">{accommodation.checkOutTime}</span>
                            </div>
                        )}
                    </div>

                    {isMiddleDay && (
                        <div className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium ${accommodation.imageUrl ? 'text-white/60' : 'text-purple-600 dark:text-purple-400'}`}>
                            Staying Night
                        </div>
                    )}

                    {accommodation.notes && (
                        <div className={`mt-2 sm:mt-3 pt-2 sm:pt-3 border-t text-[11px] sm:text-xs italic ${accommodation.imageUrl ? 'border-white/10 text-white/70' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}>
                            &quot;{accommodation.notes}&quot;
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
