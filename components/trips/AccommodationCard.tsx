'use client';

import { AccommodationDetails } from '@/types';

interface AccommodationCardProps {
    accommodation: AccommodationDetails;
    isCheckIn?: boolean;
    isCheckOut?: boolean;
}

export default function AccommodationCard({ accommodation, isCheckIn, isCheckOut }: AccommodationCardProps) {
    // If explicit flags are not provided (default behavior), assume generic info (maybe show both or minimal)
    // Actually, logic from parent decides. If both false, it's a middle day.
    const isMiddleDay = !isCheckIn && !isCheckOut;
    return (
        <div className="pb-2 sm:pb-4 group">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-2.5 sm:p-4 border border-purple-100 dark:border-purple-900/30 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-1 sm:mb-2 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base leading-tight">{accommodation.name}</h4>
                            <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">{accommodation.address}</p>
                        </div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded flex-shrink-0">
                        {accommodation.type}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2 sm:mt-3 text-[11px] sm:text-sm">
                    {(isCheckIn) && (
                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            In: <span className="font-medium ml-1">{accommodation.checkInTime}</span>
                        </div>
                    )}
                    {(isCheckOut) && (
                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Out: <span className="font-medium ml-1">{accommodation.checkOutTime}</span>
                        </div>
                    )}
                </div>

                {isMiddleDay && (
                    <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-medium">
                        Staying Night
                    </div>
                )}

                {accommodation.notes && (
                    <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700 text-[11px] sm:text-xs text-gray-500 italic">
                        &quot;{accommodation.notes}&quot;
                    </div>
                )}
            </div>
        </div>
    );
}
