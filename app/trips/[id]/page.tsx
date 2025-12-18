'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTripStore } from '@/store/tripStore';
import { format, differenceInDays, addDays } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import DayCard from '@/components/trips/DayCard';
import AddActivityModal from '@/components/trips/AddActivityModal';
import AddTransportModal from '@/components/trips/AddTransportModal';
import AddAccommodationModal from '@/components/trips/AddAccommodationModal';
import CreateTripModal from '@/components/trips/CreateTripModal';
import { Activity, TransportationDetails, AccommodationDetails, DayPlan } from '@/types';

export default function TripDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { getTrip, activeTrip, initializeDays, addActivity, addTransportation, addAccommodation, loading, updateTripDetails } = useTripStore();
    const [isInitializing, setIsInitializing] = useState(true);
    const [searchFailed, setSearchFailed] = useState(false);

    // ... (modal states remain the same) ...
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
    const [isAccommodationModalOpen, setIsAccommodationModalOpen] = useState(false);
    const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
    const [activeDayId, setActiveDayId] = useState<string | null>(null);
    const [editingAccommodation, setEditingAccommodation] = useState<AccommodationDetails | undefined>(undefined);
    const [editingTransport, setEditingTransport] = useState<TransportationDetails | undefined>(undefined);

    const tripId = params.id as string;

    // ... (processedDays memo remains the same) ...
    const processedDays = useMemo(() => {
        if (!activeTrip || !activeTrip.days) return [];

        // If no global stays, just return days as is (support legacy or empty)
        if (!activeTrip.stays || activeTrip.stays.length === 0) return activeTrip.days;

        // ... (rest of processedDays logic) ...
        // Helper to parse "YYYY-MM-DD" safely
        const parseYMD = (ymd: string): number => {
            if (!ymd) return 0;
            const parts = ymd.split('-');
            // Return midnight timestamp for comparison
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
        };

        return activeTrip.days.map(day => {
            // Clone day to avoid mutating generic state
            const newDay = { ...day };

            // Get current day timestamp (normalized)
            const dayDate = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);
            const dayTime = dayDate.getTime();

            // Reset accommodation fields (we re-calculate them from source of truth)
            newDay.accommodation = undefined;
            newDay.accommodationCheckout = undefined;

            // Sync Transportation (Project global transportation onto day if they match date)
            if (activeTrip.transportation && activeTrip.transportation.length > 0) {
                const dayDateStr = format(dayDate, 'yyyy-MM-dd');
                newDay.transportation = activeTrip.transportation.filter(f => {
                    // departureTime is timestamp
                    let fDate: Date;
                    // @ts-ignore
                    if (f.departureTime?.seconds !== undefined) {
                        // @ts-ignore
                        fDate = new Date(f.departureTime.seconds * 1000);
                    } else if (f.departureTime && typeof f.departureTime.toDate === 'function') {
                        fDate = f.departureTime.toDate();
                    } else {
                        fDate = new Date(f.departureTime as any);
                    }

                    if (isNaN(fDate.getTime())) return false;
                    return format(fDate, 'yyyy-MM-dd') === dayDateStr;
                });
            }

            // Find matching stays for this day
            activeTrip.stays?.forEach(stay => {
                const checkInTime = parseYMD(stay.checkInDate || '');
                const checkOutTime = parseYMD(stay.checkOutDate || '');

                if (checkInTime && checkOutTime) {
                    // 1. Staying (Inclusive Check-in, Exclusive Check-out)
                    if (dayTime >= checkInTime && dayTime < checkOutTime) {
                        newDay.accommodation = stay;
                    }

                    // 2. Checkout Day (Exact match)
                    if (dayTime === checkOutTime) {
                        newDay.accommodationCheckout = stay;
                    }
                }
            });

            return newDay;
        });
    }, [activeTrip]);

    // Load Trip
    useEffect(() => {
        const loadTrip = async () => {
            try {
                const trip = await getTrip(tripId);
                if (trip) {
                    await initializeDays(tripId);
                } else {
                    setSearchFailed(true);
                }
            } catch (error) {
                console.error("Error loading trip:", error);
                setSearchFailed(true);
            } finally {
                setIsInitializing(false);
            }
        };

        if (tripId) {
            loadTrip();
        }
    }, [tripId, getTrip, initializeDays]);

    // Repair Days Side Effect
    // If activeTrip is loaded but has missing days (due to legacy bugs or edits), fix them.
    useEffect(() => {
        if (!activeTrip || !activeTrip.days) return;

        const repairDays = async () => {
            const start = activeTrip.startDate instanceof Timestamp ? activeTrip.startDate.toDate() : new Date(activeTrip.startDate);
            start.setHours(0, 0, 0, 0);
            const end = activeTrip.endDate instanceof Timestamp ? activeTrip.endDate.toDate() : new Date(activeTrip.endDate);
            end.setHours(0, 0, 0, 0);

            // Inclusive day count
            const expectedCount = differenceInDays(end, start) + 1;

            if (activeTrip.days.length < expectedCount) {
                console.log(`Reparing trip days. Expected ${expectedCount}, found ${activeTrip.days.length}`);
                const newDays = [...activeTrip.days];
                for (let i = activeTrip.days.length; i < expectedCount; i++) {
                    const date = addDays(start, i);
                    newDays.push({
                        id: crypto.randomUUID(),
                        tripId: activeTrip.id,
                        date: Timestamp.fromDate(date),
                        dayNumber: i + 1,
                        transportation: [],
                        activities: [],
                        dining: [],
                        dailyBudget: 0,
                        notes: '',
                        photos: [],
                        isCompleted: false
                    } as DayPlan);
                }
                await updateTripDetails(activeTrip.id, { days: newDays });
            }
        };
        repairDays();
    }, [activeTrip, updateTripDetails]);

    const handleAddActivityClick = (dayId: string) => {
        setActiveDayId(dayId);
        setIsActivityModalOpen(true);
    };

    const handleAddTransportClick = (dayId: string) => {
        setEditingTransport(undefined);
        setIsTransportModalOpen(true);
    };

    const handleEditTransportClick = (transport: TransportationDetails) => {
        setEditingTransport(transport);
        setIsTransportModalOpen(true);
    };

    const handleAddAccommodationClick = () => {
        setActiveDayId(null); // Clear any specific day context for global add
        setEditingAccommodation(undefined); // Ensure we are in ADD mode
        setIsAccommodationModalOpen(true);
    };

    const handleEditAccommodationClick = (stay: AccommodationDetails) => {
        setEditingAccommodation(stay);
        setIsAccommodationModalOpen(true);
    };

    const handleSaveActivity = async (activityData: Partial<Activity>) => {
        if (!activeTrip || !activeDayId) return;

        const newActivity: Activity = {
            id: crypto.randomUUID(),
            ...activityData
        } as Activity;

        await addActivity(activeTrip.id, activeDayId, newActivity);
    };

    const handleSaveTransport = async (transportData: Partial<TransportationDetails>) => {
        if (!activeTrip) return;

        if (editingTransport) {
            const updatedTransport = { ...editingTransport, ...transportData } as TransportationDetails;
            await useTripStore.getState().updateTransportation(activeTrip.id, updatedTransport);
        } else {
            const newTransport = {
                id: crypto.randomUUID(),
                ...transportData
            } as TransportationDetails;
            await useTripStore.getState().addTransportation(activeTrip.id, newTransport);
        }
    };

    const handleDeleteTransport = async (id: string) => {
        if (!activeTrip) return;
        await useTripStore.getState().removeTransportation(activeTrip.id, id);
    };

    const handleSaveAccommodation = async (accommodationData: Partial<AccommodationDetails>) => {
        if (!activeTrip) return;

        if (editingAccommodation) {
            // Update existing
            const updatedAccommodation = {
                ...editingAccommodation,
                ...accommodationData
            } as AccommodationDetails;
            await useTripStore.getState().updateAccommodation(activeTrip.id, updatedAccommodation);
        } else {
            // Create new
            const newAccommodation: AccommodationDetails = {
                id: crypto.randomUUID(),
                ...accommodationData
            } as AccommodationDetails;
            await addAccommodation(activeTrip.id, newAccommodation);
        }
    };

    const handleDeleteAccommodation = async (id: string) => {
        if (!activeTrip) return;
        await useTripStore.getState().removeAccommodation(activeTrip.id, id);
    };

    const getDayDateString = (dayId: string) => {
        if (!activeTrip) return '';
        const day = activeTrip.days.find(d => d.id === dayId);
        if (!day) return '';

        const date = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
        return format(date, 'MMM d');
    };

    const getDayDateIso = (dayId: string) => {
        if (!activeTrip) return '';
        const day = activeTrip.days.find(d => d.id === dayId);
        if (!day) return '';

        const date = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
        return date.toISOString().split('T')[0];
    };

    if (isInitializing || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (searchFailed || !activeTrip) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center max-w-md">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Trip Not Found</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">We couldn't find the trip you're looking for. It may have been deleted.</p>
                    <button
                        onClick={() => router.push('/trips')}
                        className="w-full px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-semibold"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const startDate = activeTrip.startDate instanceof Timestamp ? activeTrip.startDate.toDate() : new Date(activeTrip.startDate);
    const endDate = activeTrip.endDate instanceof Timestamp ? activeTrip.endDate.toDate() : new Date(activeTrip.endDate);
    const currencyCode = activeTrip.budget?.currency || 'CNY';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm/50 backdrop-blur-md bg-white/90 dark:bg-gray-800/90 supports-[backdrop-filter]:bg-white/60">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/trips')}
                                className="p-2 -ml-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white leading-tight">{activeTrip.title}</h1>
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-3 mt-0.5">
                                    <span className="flex items-center">
                                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {activeTrip.destination}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center">
                                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full text-xs font-semibold border border-primary-100 dark:border-primary-800">
                                {activeTrip.days?.length || 0} Days
                            </div>
                            {/* Placeholder for future actions */}
                            <button
                                onClick={() => setIsEditTripModalOpen(true)}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Edit Trip Details"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>

                            <button
                                onClick={async () => {
                                    const shareData = {
                                        title: `Trip to ${activeTrip.destination}`,
                                        text: `Check out my trip plan for ${activeTrip.destination}!`,
                                        url: window.location.href
                                    };

                                    if (navigator.share) {
                                        try {
                                            await navigator.share(shareData);
                                        } catch (err) {
                                            console.error('Error sharing:', err);
                                        }
                                    } else {
                                        try {
                                            await navigator.clipboard.writeText(window.location.href);
                                            alert('Link copied to clipboard!');
                                        } catch (err) {
                                            console.error('Failed to copy link:', err);
                                            alert('Failed to copy link. Please copy the URL manually.');
                                        }
                                    }
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Share trip"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            </button>

                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    if (!activeTrip) {
                                        alert("No active trip to export!");
                                        return;
                                    }

                                    try {
                                        // 1. Serialize
                                        const tripToExport = JSON.parse(JSON.stringify(activeTrip));
                                        // eslint-disable-next-line
                                        const serialize = (obj: any): any => {
                                            if (obj && typeof obj === 'object') {
                                                for (const key in obj) {
                                                    if (obj[key] && typeof obj[key] === 'object' && 'seconds' in obj[key] && 'nanoseconds' in obj[key]) {
                                                        obj[key] = new Date(obj[key].seconds * 1000).toISOString();
                                                    } else if (typeof obj[key] === 'object') {
                                                        serialize(obj[key]);
                                                    }
                                                }
                                            }
                                        };
                                        serialize(tripToExport);
                                        const jsonString = JSON.stringify(tripToExport, null, 2);
                                        const filename = `${(activeTrip.title || "trip").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`;

                                        // 2. Try File System Access API (Write directly to file)
                                        try {
                                            // @ts-ignore - File System Access API is not yet in standard TS lib
                                            if (window.showSaveFilePicker) {
                                                // @ts-ignore
                                                const handle = await window.showSaveFilePicker({
                                                    suggestedName: filename,
                                                    types: [{
                                                        description: 'JSON Trip Data',
                                                        accept: { 'application/json': ['.json'] },
                                                    }],
                                                });
                                                const writable = await handle.createWritable();
                                                await writable.write(jsonString);
                                                await writable.close();
                                                alert("Trip exported successfully!");
                                                return;
                                            }
                                        } catch (fsError: any) {
                                            // User cancelled or not supported, fall back to download
                                            if (fsError.name !== 'AbortError') {
                                                console.log('File System Access API failed, falling back to download:', fsError);
                                            } else {
                                                return; // User cancelled
                                            }
                                        }

                                        // 3. Fallback: standard download (using file-saver dynamically if possible, or blob)
                                        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });

                                        // Use dynamic import to avoid SSR issues with file-saver if needed, or just plain Blob for simplicity + reliability
                                        // Previous manual blob method is actually standard. 'file-saver' creates an <a> tag internally too.
                                        // The user's issue might be correct mime type or handling.

                                        // Let's use the explicit <a> tag method again but refined, as it's purely client-side.
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.style.display = "none";
                                        a.href = url;
                                        a.download = filename;
                                        document.body.appendChild(a);
                                        a.click();

                                        setTimeout(() => {
                                            document.body.removeChild(a);
                                            window.URL.revokeObjectURL(url);
                                        }, 100);

                                    } catch (err: any) {
                                        console.error('Export error:', err);
                                        alert('Error creating export file: ' + err.message);
                                    }
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Export Trip"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Itinerary */}
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                    {/* Left: Day List */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Itinerary</h2>
                            <span className="text-sm text-gray-500">
                                {processedDays?.reduce((acc, day) => acc + (day.activities?.length || 0) + (day.transportation?.length || 0) + (day.accommodation ? 1 : 0), 0) || 0} Items
                            </span>
                        </div>

                        {processedDays && processedDays.length > 0 ? (
                            <div className="space-y-6">
                                {processedDays.map((day) => (
                                    <DayCard
                                        key={day.id}
                                        day={day}
                                        onAddActivity={() => handleAddActivityClick(day.id)}
                                        onEditTransport={handleEditTransportClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 mb-2">Setting up your itinerary...</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Sidebar */}
                    <div className="hidden lg:block space-y-6 sticky top-24 h-fit">

                        {/* My Flights */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24">
                                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                    </svg>
                                    Transportation
                                </h3>
                                <button
                                    onClick={() => handleAddTransportClick('')}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-semibold"
                                >
                                    + Add
                                </button>
                            </div>

                            {activeTrip.transportation && activeTrip.transportation.length > 0 ? (
                                <div className="space-y-3">
                                    {activeTrip.transportation.map((transport) => (
                                        <div
                                            key={transport.id}
                                            onClick={() => handleEditTransportClick(transport)}
                                            className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        {transport.airline}
                                                        {transport.type === 'train' && (
                                                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 2h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z M6 10h12 M9 16l3 3 3-3" />
                                                            </svg>
                                                        )}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-normal">
                                                        {transport.flightNumber}
                                                        {transport.type === 'flight' && (
                                                            <svg className="w-3 h-3 text-blue-500 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                                            </svg>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-mono text-gray-400">{transport.departureAirportCode} → {transport.arrivalAirportCode}</div>
                                            </div>
                                            <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                                                <div className="capitalize">{transport.type} • {(() => {
                                                    const t = transport.departureTime as any;
                                                    let date: Date;
                                                    if (t?.seconds !== undefined) {
                                                        date = new Date(t.seconds * 1000);
                                                    } else if (t && typeof t.toDate === 'function') {
                                                        date = t.toDate();
                                                    } else {
                                                        date = new Date(t);
                                                    }
                                                    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'MMM d, HH:mm');
                                                })()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                                    <p className="text-gray-400 text-sm">No flights added</p>
                                </div>
                            )}
                        </div>

                        {/* My Stays */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    My Stays
                                </h3>
                                <button
                                    // Make sure we use the global add handler properly
                                    onClick={handleAddAccommodationClick}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-semibold"
                                >
                                    + Add Stay
                                </button>
                            </div>

                            {activeTrip.stays && activeTrip.stays.length > 0 ? (
                                <div className="space-y-4">
                                    {activeTrip.stays.map((stay) => (
                                        <div
                                            key={stay.id}
                                            onClick={() => handleEditAccommodationClick(stay)}
                                            className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{stay.name}</div>
                                            <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                                                <div>{stay.checkInDate} - {stay.checkOutDate}</div>
                                                <div className="truncate">{stay.address}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic mb-4">No stays added yet.</div>
                            )}

                            <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Trip Summary</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Duration</span>
                                    <span className="font-medium">{activeTrip.days?.length} Days</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total Activities</span>
                                    <span className="font-medium">{activeTrip.days?.reduce((acc, day) => acc + (day.activities?.length || 0), 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Transportation</span>
                                    <span className="font-medium">{activeTrip.transportation?.length || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Accommodations</span>
                                    <span className="font-medium">{processedDays?.filter(day => day.accommodation).length || 0}</span>
                                </div>
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex justify-between items-center text-primary-600 font-medium cursor-pointer hover:text-primary-700">
                                        <span>View Budget</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AddActivityModal
                isOpen={isActivityModalOpen}
                onClose={() => setIsActivityModalOpen(false)}
                onSave={handleSaveActivity}
                dayDate={activeDayId ? getDayDateString(activeDayId) : ''}
                currencyCode={currencyCode}
            />

            <AddTransportModal
                isOpen={isTransportModalOpen}
                onClose={() => setIsTransportModalOpen(false)}
                onSave={handleSaveTransport}
                onDelete={handleDeleteTransport}
                dayDate="Trip Duration" // Global context
                dayDateIso={startDate.toISOString().split('T')[0]}
                currencyCode={currencyCode}
                initialData={editingTransport}
            />

            <AddAccommodationModal
                isOpen={isAccommodationModalOpen}
                onClose={() => setIsAccommodationModalOpen(false)}
                onSave={handleSaveAccommodation}
                onDelete={handleDeleteAccommodation}
                dayDate="Trip Duration"
                dayDateIso={startDate.toISOString().split('T')[0]} // Default to trip start
                currencyCode={currencyCode}
                initialData={editingAccommodation}
            />

            {activeTrip && (
                <CreateTripModal
                    isOpen={isEditTripModalOpen}
                    onClose={() => setIsEditTripModalOpen(false)}
                    tripToEdit={activeTrip}
                />
            )}
        </div>
    );
}
