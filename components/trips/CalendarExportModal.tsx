'use client';

import { useState, useMemo } from 'react';
import { Trip } from '@/types';
import { generateTripCalendar, downloadICSFile, generateGoogleCalendarUrls } from '@/lib/calendarExport';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

interface CalendarExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    trip: Trip;
}

type ExportMethod = 'apple' | 'google' | null;

export default function CalendarExportModal({ isOpen, onClose, trip }: CalendarExportModalProps) {
    const [selectedMethod, setSelectedMethod] = useState<ExportMethod>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [showGoogleEvents, setShowGoogleEvents] = useState(false);

    const googleEvents = useMemo(() => {
        return generateGoogleCalendarUrls(trip);
    }, [trip]);

    const eventStats = useMemo(() => {
        let activities = 0;
        let transports = 0;
        let stays = 0;

        if (trip.days) {
            for (const day of trip.days) {
                activities += day.activities?.length || 0;
            }
        }
        transports = trip.transportation?.length || 0;
        stays = trip.stays?.length || 0;

        return { activities, transports, stays, total: activities + transports + (stays * 2) };
    }, [trip]);

    const handleExportICS = async () => {
        setIsExporting(true);
        try {
            const icsContent = generateTripCalendar(trip);
            const filename = `${(trip.title || 'trip').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.ics`;

            if (Capacitor.isNativePlatform()) {
                try {
                    // Write file to cache directory
                    const result = await Filesystem.writeFile({
                        path: filename,
                        data: icsContent,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8,
                    });

                    // Share the file so user can open it with their calendar app
                    await Share.share({
                        title: 'Add to Calendar',
                        text: `${trip.title} - Itinerary`,
                        url: result.uri,
                        dialogTitle: 'Open with Calendar',
                    });
                } catch (nativeErr) {
                    console.error('Native calendar export error:', nativeErr);
                    // Fallback: show alert with instructions
                    if (!(nativeErr instanceof Error) || !nativeErr.message.includes('canceled')) {
                        alert('Please save the file and open it with your Calendar app.');
                    }
                }
            } else {
                // Web: Download the ICS file
                downloadICSFile(icsContent, filename);
            }

            onClose();
        } catch (err) {
            console.error('Calendar export error:', err);
            alert('Failed to export calendar. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleGoogleEventClick = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Export to Calendar</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {eventStats.total} events to export
                            </p>
                        </div>
                    </div>
                </div>

                {/* Event Summary */}
                <div className="mx-6 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center justify-around text-center">
                        <div>
                            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                                {eventStats.activities}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Activities</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200 dark:bg-gray-600" />
                        <div>
                            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                {eventStats.transports}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Transport</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200 dark:bg-gray-600" />
                        <div>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {eventStats.stays}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Stays</div>
                        </div>
                    </div>
                </div>

                {/* Calendar Options */}
                {!showGoogleEvents ? (
                    <div className="px-6 pb-6 space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Choose how you&apos;d like to add events to your calendar:
                        </p>

                        {/* Apple Calendar / ICS Option */}
                        <button
                            onClick={() => {
                                setSelectedMethod('apple');
                                handleExportICS();
                            }}
                            disabled={isExporting}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'apple'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                                </svg>
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-semibold text-gray-900 dark:text-white">
                                    Apple Calendar
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Download .ics file for iOS/macOS
                                </div>
                            </div>
                            {isExporting && selectedMethod === 'apple' ? (
                                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )}
                        </button>

                        {/* Google Calendar Option */}
                        <button
                            onClick={() => {
                                setSelectedMethod('google');
                                setShowGoogleEvents(true);
                            }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${selectedMethod === 'google'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-200">
                                <svg className="w-7 h-7" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-semibold text-gray-900 dark:text-white">
                                    Google Calendar
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Add events one by one to Google
                                </div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* Tip */}
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex gap-2">
                                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    <strong>Tip:</strong> The .ics file works with most calendar apps including Apple Calendar, Outlook, and Android Calendar.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Google Events List */
                    <div className="px-6 pb-6">
                        <button
                            onClick={() => setShowGoogleEvents(false)}
                            className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-4"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to options
                        </button>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Click on each event to add it to your Google Calendar:
                        </p>

                        <div className="max-h-64 overflow-y-auto space-y-2 pr-2 -mr-2">
                            {googleEvents.map((event, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleGoogleEventClick(event.url)}
                                    className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                                >
                                    <span className="text-lg">{event.title.split(' ')[0]}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                            {event.title.slice(2).trim()}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                            {event.type}
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </button>
                            ))}
                        </div>

                        {googleEvents.length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-sm">No events to export</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
