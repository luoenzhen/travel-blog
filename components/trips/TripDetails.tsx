'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTripStore } from '@/store/tripStore';
import { format, differenceInDays, addDays } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import DayCard from '@/components/trips/DayCard';
import AddActivityModal from '@/components/trips/AddActivityModal';
import AddTransportModal from '@/components/trips/AddTransportModal';
import AddAccommodationModal from '@/components/trips/AddAccommodationModal';
import CreateTripModal from '@/components/trips/CreateTripModal';
import BudgetModal from '@/components/trips/BudgetModal';
import AddPhotoModal from '@/components/trips/AddPhotoModal';
import { Activity, TransportationDetails, AccommodationDetails, DayPlan, TripBudget, Media } from '@/types';
import { MapProviderKey } from '@/lib/maps';
import { generateMagicDayActivities, geocodeLocations } from '@/lib/ai';
import dynamic from 'next/dynamic';

const TripMap = dynamic(() => import('./TripMap'), { ssr: false });
import {
    DndContext,
    useDraggable,
    useDroppable,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function DraggableMagicWand({ isGenerating }: { isGenerating: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: 'magic-wand',
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: 100,
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            disabled={isGenerating}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all group/magic disabled:opacity-50 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : 'animate-bounce-subtle'}`}
            title="Drag me to a day to generate magic activities!"
        >
            {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <svg className="w-4 h-4 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )}
            <span className="text-xs font-bold whitespace-nowrap">Magic Wand</span>
        </button>
    );
}

function DroppableDay({ children, dayId }: { children: React.ReactNode; dayId: string }) {
    const { isOver, setNodeRef } = useDroppable({
        id: dayId,
    });

    return (
        <div
            ref={setNodeRef}
            className={`transition-all duration-300 rounded-2xl ${isOver ? 'ring-4 ring-purple-500/50 scale-[1.02] shadow-2xl relative z-20' : ''}`}
        >
            {isOver && (
                <div className="absolute inset-0 bg-purple-500/10 rounded-2xl pointer-events-none z-50 animate-pulse flex items-center justify-center">
                    <div className="bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-full shadow-lg border border-purple-200 dark:border-purple-800">
                        <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">Drop to generate magic! ✨</span>
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}

export default function TripDetailsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { getTrip, activeTrip, initializeDays, addActivity, addAccommodation, loading, updateTripDetails, updateWeather } = useTripStore();
    const [isInitializing, setIsInitializing] = useState(true);
    const [searchFailed, setSearchFailed] = useState(false);
    const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

    // ... (modal states remain the same) ...
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
    const [isAccommodationModalOpen, setIsAccommodationModalOpen] = useState(false);
    const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [activeDayId, setActiveDayId] = useState<string | null>(null);
    const [editingAccommodation, setEditingAccommodation] = useState<AccommodationDetails | undefined>(undefined);
    const [editingTransport, setEditingTransport] = useState<TransportationDetails | undefined>(undefined);
    const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);
    const [isMagicGenerating, setIsMagicGenerating] = useState(false);

    const [focusedActivityId, setFocusedActivityId] = useState<string | null>(null);
    const [customMapLocation, setCustomMapLocation] = useState<{ lat: number; lng: number; name?: string; } | null>(null);
    const [lastGeneratedIds, setLastGeneratedIds] = useState<Record<string, string[]>>({});
    const [showMap, setShowMap] = useState(false);
    const [activeTab, setActiveTab] = useState<'itinerary' | 'transport' | 'stay' | 'map'>('itinerary');
    const [mapProvider, setMapProvider] = useState<MapProviderKey>('OSM');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const isProgrammaticScroll = useRef(false);
    const itineraryContainerRef = useRef<HTMLDivElement>(null);
    const activeDayIdRef = useRef<string | null>(null);

    // Keep ref in sync
    useEffect(() => {
        activeDayIdRef.current = activeDayId;
    }, [activeDayId]);

    // Auto-dismiss error toast
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    const sensorsMagic = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const mapOverlayInfo = useMemo(() => {
        if (customMapLocation) {
            return {
                title: 'Search Result',
                subtitle: customMapLocation.name || 'Custom Location',
                type: 'custom',
                fullDate: 'Location Result'
            };
        }

        if (activeTrip) {
            // 1. Try to find by focusedActivityId
            if (focusedActivityId) {
                let foundDayIndex = -1;
                let foundItem: Activity | AccommodationDetails | undefined;
                let itemType = 'activity';

                activeTrip.days.some((day, index) => {
                    const act = day.activities?.find(a => a.id === focusedActivityId);
                    if (act) {
                        foundDayIndex = index;
                        foundItem = act;
                        itemType = 'activity';
                        return true;
                    }
                    const stay = day.accommodation?.id === focusedActivityId ? day.accommodation : undefined;
                    if (stay) {
                        foundDayIndex = index;
                        foundItem = stay;
                        itemType = 'stay';
                        return true;
                    }
                    return false;
                });

                if (foundItem) {
                    const dateObj = activeTrip.days[foundDayIndex].date?.toDate();
                    const dateStr = dateObj ? format(dateObj, 'EEE, MMM d') : `Day ${foundDayIndex + 1}`;
                    const fullDateStr = dateObj ? format(dateObj, 'EEEE, MMMM d') : `Day ${foundDayIndex + 1}`;

                    return {
                        title: dateStr,
                        subtitle: foundItem.name,
                        type: itemType,
                        fullDate: fullDateStr
                    };
                }
            }

            // 2. Fallback: If only Day is active (e.g. accordion open)
            if (activeDayId && !focusedActivityId) {
                const dayIndex = activeTrip.days.findIndex(d => d.id === activeDayId);
                if (dayIndex !== -1) {
                    const day = activeTrip.days[dayIndex];
                    const dateObj = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date as unknown as string);
                    const fullDateStr = isNaN(dateObj.getTime()) ? `Day ${day.dayNumber}` : format(dateObj, 'EEEE, MMMM d');

                    return {
                        title: `Day ${day.dayNumber}`,
                        subtitle: `Day ${day.dayNumber}`,
                        type: 'day',
                        fullDate: fullDateStr
                    };
                }
            }
        }
        return null;
    }, [focusedActivityId, activeDayId, customMapLocation, activeTrip]);

    // Disable body scroll on mobile when map is active
    useEffect(() => {
        // Only apply on mobile (screens smaller than lg breakpoint)
        const isMobile = window.innerWidth < 1024;

        if (isMobile && activeTab === 'map') {
            // Save current scroll position
            const scrollY = window.scrollY;

            // Disable scroll
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';

            return () => {
                // Re-enable scroll
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';

                // Restore scroll position
                window.scrollTo(0, scrollY);
            };
        }
    }, [activeTab]);


    const tripId = (params.id as string) || searchParams.get('id') || '';

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

        return [...activeTrip.days]
            .sort((a, b) => {
                const dateA = a.date instanceof Timestamp ? a.date.toDate().getTime() : new Date(a.date).getTime();
                const dateB = b.date instanceof Timestamp ? b.date.toDate().getTime() : new Date(b.date).getTime();
                return dateA - dateB;
            })
            .map(day => {
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
                    newDay.transportation = activeTrip.transportation.filter(f => {
                        // departureTime is timestamp
                        let fDate: Date;
                        const depTime = f.departureTime as unknown as { seconds?: number; toDate?: () => Date };
                        if (depTime?.seconds !== undefined) {
                            fDate = new Date(depTime.seconds * 1000);
                        } else if (typeof depTime?.toDate === 'function') {
                            fDate = depTime.toDate();
                        } else {
                            fDate = new Date(f.departureTime as unknown as string | number | Date);
                        }

                        if (isNaN(fDate.getTime())) return false;
                        return fDate.toLocaleDateString('en-CA') === dayDate.toLocaleDateString('en-CA');
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

    useEffect(() => {
        if (tripId) {
            setHasInitialScrolled(false);
        }
    }, [tripId]);

    // Load Trip
    useEffect(() => {
        const loadTrip = async () => {
            try {
                const trip = await getTrip(tripId);
                if (trip) {
                    await initializeDays(tripId);
                    // Fetch weather asynchronously so it doesn't block UI
                    updateWeather(tripId);
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
    }, [tripId, getTrip, initializeDays, updateWeather]);

    // Repair Days Side Effect
    // If activeTrip is loaded but has missing days (due to legacy bugs or edits), fix them.
    useEffect(() => {
        if (!activeTrip || !activeTrip.days) return;

        const repairDays = async () => {
            const start = activeTrip.startDate instanceof Timestamp ? activeTrip.startDate.toDate() : new Date(activeTrip.startDate);
            start.setHours(0, 0, 0, 0);
            const end = activeTrip.endDate instanceof Timestamp ? activeTrip.endDate.toDate() : new Date(activeTrip.endDate);
            end.setHours(0, 0, 0, 0);

            const expectedCount = differenceInDays(end, start) + 1;
            const existingDays = [...activeTrip.days];
            const newDays: DayPlan[] = [];

            let hasChanges = false;

            for (let i = 0; i < expectedCount; i++) {
                const targetDate = addDays(start, i);
                const targetDateStr = format(targetDate, 'yyyy-MM-dd');

                // Find if we already have this day
                const existingDay = existingDays.find(d => {
                    const dDate = d.date instanceof Timestamp ? d.date.toDate() : new Date(d.date);
                    return format(dDate, 'yyyy-MM-dd') === targetDateStr;
                });

                if (existingDay) {
                    // Update dayNumber if it changed, and ensure it has an ID
                    if (existingDay.dayNumber !== i + 1 || !existingDay.id) {
                        newDays.push({
                            ...existingDay,
                            dayNumber: i + 1,
                            id: existingDay.id || crypto.randomUUID()
                        });
                        hasChanges = true;
                    } else {
                        newDays.push(existingDay);
                    }
                } else {
                    // Create new day
                    newDays.push({
                        id: crypto.randomUUID(),
                        tripId: activeTrip.id,
                        date: Timestamp.fromDate(targetDate),
                        dayNumber: i + 1,
                        transportation: [],
                        activities: [],
                        dining: [],
                        dailyBudget: 0,
                        notes: '',
                        photos: [],
                        isCompleted: false
                    } as DayPlan);
                    hasChanges = true;
                }
            }

            // Also check if we have extra days that are now out of range
            if (existingDays.length !== expectedCount) hasChanges = true;

            if (hasChanges) {
                await updateTripDetails(activeTrip.id, { days: newDays });
            }
        };
        repairDays();
    }, [activeTrip, updateTripDetails]);

    const handleAddActivityClick = (dayId: string) => {
        setActiveDayId(dayId);
        setEditingActivity(undefined);
        setIsActivityModalOpen(true);
    };

    const handleEditActivityClick = (dayId: string, activity: Activity) => {
        setActiveDayId(dayId);
        setEditingActivity(activity);
        setIsActivityModalOpen(true);
    };

    const handleToggleActivityLock = async (dayId: string, activityId: string) => {
        if (!activeTrip) return;
        await useTripStore.getState().toggleActivityLock(activeTrip.id, dayId, activityId);
    };

    const handleAddPhotoClick = (dayId: string) => {
        setActiveDayId(dayId);
        setIsPhotoModalOpen(true);
    };

    const handleAddTransportClick = () => {
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

        // Auto-geocode if missing
        if (activityData.location && (!activityData.location.latitude || !activityData.location.longitude)) {
            const coords = await geocodeLocations([activityData.location.name]);
            if (coords[activityData.location.name]) {
                activityData.location = { ...activityData.location, ...coords[activityData.location.name] };
            }
        }

        if (editingActivity) {
            const updatedActivity = { ...editingActivity, ...activityData } as Activity;
            await useTripStore.getState().updateActivity(activeTrip.id, activeDayId, updatedActivity);
        } else {
            const newActivity: Activity = {
                id: crypto.randomUUID(),
                ...activityData
            } as Activity;

            await addActivity(activeTrip.id, activeDayId, newActivity);
        }
    };

    const handleDeleteActivity = async (activityId: string) => {
        if (!activeTrip || !activeDayId) return;
        await useTripStore.getState().removeActivity(activeTrip.id, activeDayId, activityId);
    };

    const handleSavePhoto = async (photoData: Media) => {
        if (!activeTrip || !activeDayId) return;
        await useTripStore.getState().addPhoto(activeTrip.id, activeDayId, photoData);
    };

    const handleRemovePhoto = async (dayId: string, photoId: string) => {
        if (!activeTrip) return;
        await useTripStore.getState().removePhoto(activeTrip.id, dayId, photoId);
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

    const handleMagicGenerateDay = async (day: DayPlan) => {
        if (!activeTrip) return;
        setIsMagicGenerating(true);

        try {
            const dateStr = format(day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date), 'yyyy-MM-dd');

            // Get current active accommodation for this day from processedDays to be accurate
            const processedDay = processedDays.find(d => d.id === day.id);
            const accommodation = processedDay?.accommodation;

            // Attempt to pinpoint the CURRENT city/location for this specific day
            // Priority: Accommodation Location > Existing Activity Location > Trip Destination
            const dayActivitiesArr = day.activities || [];
            const dayActivitiesStr = dayActivitiesArr.map(a => `${a.name}: ${a.notes || ''}`).join('; ');
            const otherActivities = activeTrip.days?.flatMap(d =>
                d.id !== day.id ? (d.activities || []).map(a => `${a.name}: ${a.notes || ''}`) : []
            ).slice(0, 10).join('; ');

            const langStrings = [
                activeTrip.title,
                accommodation ? `${accommodation.name}: ${accommodation.notes || ''}` : null,
                dayActivitiesStr,
                otherActivities
            ].filter(Boolean);

            const languageContext = langStrings.join(' | ').substring(0, 500);

            const specificLocation =
                accommodation?.location?.name ||
                dayActivitiesArr.find(a => a.location?.name)?.location?.name ||
                activeTrip.destination;

            const newActivities = await generateMagicDayActivities(
                specificLocation,
                dateStr,
                dayActivitiesArr,
                accommodation,
                languageContext
            );

            // Add each activity sequentially and keep track of IDs for UNDO
            const generatedIds: string[] = [];
            for (const activity of newActivities) {
                const activityId = activity.id || crypto.randomUUID();
                const activityWithId = { ...activity, id: activityId };
                await addActivity(activeTrip.id, day.id, activityWithId);
                generatedIds.push(activityId);
            }

            // Store for undo
            setLastGeneratedIds(prev => ({
                ...prev,
                [day.id]: generatedIds
            }));
        } catch (error: unknown) {
            console.error("Magic generate failed:", error);
            const message = error instanceof Error ? error.message : "Failed to generate activities.";
            alert(message);
        } finally {
            setIsMagicGenerating(false);
        }
    };

    const handleUndoMagic = async (dayId: string) => {
        if (!activeTrip || !lastGeneratedIds[dayId]) return;

        const idsToRemove = lastGeneratedIds[dayId];

        // Remove from store
        for (const activityId of idsToRemove) {
            await useTripStore.getState().removeActivity(activeTrip.id, dayId, activityId);
        }

        // Clear undo state for this day
        setLastGeneratedIds(prev => {
            const next = { ...prev };
            delete next[dayId];
            return next;
        });
    };

    const handleOptimizeRoute = async (dayId: string) => {
        if (!activeTrip) return;
        const day = activeTrip.days.find(d => d.id === dayId);
        if (!day || !day.activities || day.activities.length <= 1) return;

        const activities = [...day.activities];
        const optimized: string[] = [];

        // Start with accommodation if exists, otherwise first activity
        let currentPos = day.accommodation?.location || activities[0].location;
        const remaining = [...activities];

        // Basic nearest-neighbor route optimization (Greedy Traveling Salesman)
        while (remaining.length > 0) {
            let nearestIdx = 0;
            let minDist = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const act = remaining[i];
                if (!act.location?.latitude || !act.location?.longitude || !currentPos?.latitude || !currentPos?.longitude) {
                    minDist = 0;
                    nearestIdx = i;
                    break;
                }

                // Squared distance for performance
                const dist = Math.pow(act.location.latitude - currentPos.latitude, 2) +
                    Math.pow(act.location.longitude - currentPos.longitude, 2);

                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }

            const next = remaining.splice(nearestIdx, 1)[0];
            optimized.push(next.id);
            currentPos = next.location;
        }

        // Add stay and transport placeholders back if they exist in customOrder
        const fullOrder = [...(day.customOrder || [])];
        const activityIds = day.activities.map(a => a.id);

        // Filter out old activities and insert optimized ones in place
        const nonActivityIds = fullOrder.filter(id => !activityIds.includes(id));
        const finalOrder = [...nonActivityIds, ...optimized];

        await useTripStore.getState().updateDayOrder(activeTrip.id, dayId, finalOrder);
    };

    const handleDragEndMagic = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id === 'magic-wand' && over) {
            const dayId = over.id as string;
            const day = activeTrip?.days.find(d => d.id === dayId);
            if (day) {
                handleMagicGenerateDay(day);
            }
        }
    };


    const handleDeleteTransport = async (id: string) => {
        if (!activeTrip) return;
        await useTripStore.getState().removeTransportation(activeTrip.id, id);
    };

    const handleSaveAccommodation = async (accommodationData: Partial<AccommodationDetails>) => {
        if (!activeTrip) return;

        // Auto-geocode if missing
        if (accommodationData.location && (!accommodationData.location.latitude || !accommodationData.location.longitude)) {
            try {
                const coords = await geocodeLocations([accommodationData.location.name]);
                if (coords[accommodationData.location.name]) {
                    accommodationData.location = { ...accommodationData.location, ...coords[accommodationData.location.name] };
                }
            } catch (error: unknown) {
                console.error("Auto-geocode failed:", error);
                // Don't alert here to avoid annoyance, just log.
            }
        }

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

    const handleSaveBudget = async (budget: TripBudget) => {
        if (!activeTrip) return;
        await useTripStore.getState().updateTripBudget(activeTrip.id, budget);
    };

    const handleSyncLocations = async () => {
        if (!activeTrip) return;

        const locNames = new Set<string>();
        activeTrip.days.forEach(d => {
            d.activities?.forEach(a => {
                if (!a.location.latitude || !a.location.longitude) locNames.add(a.location.name);
            });
            if (d.accommodation && (!d.accommodation.location.latitude || !d.accommodation.location.longitude)) {
                locNames.add(d.accommodation.location.name);
            }
        });

        activeTrip.stays?.forEach(s => {
            if (!s.location.latitude || !s.location.longitude) locNames.add(s.location.name);
        });

        if (locNames.size === 0) {
            alert("All locations already have coordinates!");
            return;
        }

        let coords: Record<string, { latitude: number; longitude: number }> = {};
        try {
            coords = await geocodeLocations(Array.from(locNames));
        } catch (error: unknown) {
            console.error("Sync locations failed:", error);
            const message = error instanceof Error ? error.message : "Failed to sync locations due to AI error.";
            alert(message);
            return;
        }

        const updatedDays = activeTrip.days.map(d => ({
            ...d,
            activities: d.activities.map(a => ({
                ...a,
                location: {
                    ...a.location,
                    ...(coords[a.location.name] || {})
                }
            })),
            accommodation: d.accommodation ? {
                ...d.accommodation,
                location: {
                    ...d.accommodation.location,
                    ...(coords[d.accommodation.location.name] || {})
                }
            } : undefined
        }));

        const updatedStays = activeTrip.stays?.map(s => ({
            ...s,
            location: {
                ...s.location,
                ...(coords[s.location.name] || {})
            }
        }));

        await updateTripDetails(activeTrip.id, {
            days: updatedDays,
            stays: updatedStays
        });

        alert(`Synced ${Object.keys(coords).length} locations!`);
    };

    const getDayDateString = (dayId: string) => {
        if (!activeTrip) return '';
        const day = activeTrip.days.find(d => d.id === dayId);
        if (!day) return '';

        const date = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
        return format(date, 'MMM d');
    };    // Scroll to today's card on initial load
    useEffect(() => {
        // Only run if not initializing, not loading, hasn't scrolled yet, and we have days
        if (!isInitializing && !loading && !hasInitialScrolled && processedDays.length > 0) {
            const now = new Date();

            const todayDay = processedDays.find(day => {
                const date = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
                const match = (
                    date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear()
                );
                return match;
            });

            if (todayDay) {
                setHasInitialScrolled(true);

                const performScroll = () => {
                    const el = document.getElementById(`day-${todayDay.id}`);
                    if (el) {
                        const container = itineraryContainerRef.current;
                        if (container && window.innerWidth >= 1024) { // Desktop
                            isProgrammaticScroll.current = true;
                            // Calculate relative position within container
                            // Note: offsetTop is relative to offsetParent. If container is relative/absolute, this works.
                            // Better: el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
                            const relativeTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
                            container.scrollTo({ top: relativeTop - 20, behavior: 'smooth' }); // -20 padding
                            setTimeout(() => { isProgrammaticScroll.current = false; }, 1000);
                        } else {
                            // Mobile / Window Scroll
                            const rect = el.getBoundingClientRect();
                            const offset = window.innerWidth < 640 ? 80 : 120;
                            const top = window.pageYOffset + rect.top - offset;
                            window.scrollTo({ top, behavior: 'smooth' });
                        }
                    }
                };

                // Multiple attempts as the page reaches its final layout
                setTimeout(performScroll, 500);
                setTimeout(performScroll, 1200);
                setTimeout(performScroll, 2500);
            }
        }
    }, [isInitializing, loading, hasInitialScrolled, processedDays]);


    // Intersection Observer for scroll-to-map sync
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const dayId = entry.target.id.replace('day-', '');

                        if (!isProgrammaticScroll.current) {
                            setActiveDayId(dayId);
                            // Clear specific activity focus on manual scroll to update header
                            setFocusedActivityId(null);
                            setCustomMapLocation(null);
                        } else {
                            // Just update the active day tracking without clearing focus
                            setActiveDayId(dayId);
                        }
                    }
                });
            },
            { threshold: 0.3, rootMargin: '-10% 0px -50% 0px' }
        );

        const dayElements = document.querySelectorAll('[id^="day-"]');
        dayElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [processedDays, isInitializing]);

    const handleMarkerClick = (id: string, type: 'activity' | 'stay') => {
        isProgrammaticScroll.current = true;
        setFocusedActivityId(id);

        // Find which day this item belongs to and update activeDayId
        const dayWithItem = activeTrip?.days.find(d =>
            (type === 'activity' && d.activities?.some(a => a.id === id)) ||
            (type === 'stay' && d.accommodation?.id === id)
        );

        if (dayWithItem) {
            setActiveDayId(dayWithItem.id);

            // Explicitly scroll to the day for seamless navigation
            setTimeout(() => {
                const element = document.getElementById(`day-${dayWithItem.id}`);
                const container = itineraryContainerRef.current;

                if (element) {
                    isProgrammaticScroll.current = true;
                    if (container && window.innerWidth >= 1024) {
                        const relativeTop = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
                        container.scrollTo({ top: relativeTop - 20, behavior: 'smooth' });
                    } else {
                        const offset = window.innerWidth < 640 ? 80 : 120;
                        const top = element.getBoundingClientRect().top + window.scrollY - offset;
                        window.scrollTo({ top, behavior: 'smooth' });
                    }
                    setTimeout(() => { isProgrammaticScroll.current = false; }, 1000);
                }
            }, 50);
        } else {
            // Reset flag if no scroll needed
            setTimeout(() => { isProgrammaticScroll.current = false; }, 1000);
        }

        // Highlight the card if visible
        const el = document.getElementById(type === 'stay' ? `stay-${id}` : `activity-${id}`);
        if (el) {
            el.classList.add('ring-4', 'ring-primary-500/50');
            setTimeout(() => el.classList.remove('ring-4', 'ring-primary-500/50'), 2000);
        }
    };

    // Scroll to active day when switching to itinerary tab
    useEffect(() => {
        if (activeTab === 'itinerary' && activeDayIdRef.current) {
            const targetId = activeDayIdRef.current;
            // Short timeout to allow layout to settle (e.g. from hidden state)
            setTimeout(() => {
                const element = document.getElementById(`day-${targetId}`);
                if (element) {
                    isProgrammaticScroll.current = true;
                    const container = itineraryContainerRef.current;

                    if (container && window.innerWidth >= 1024) {
                        const relativeTop = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
                        container.scrollTo({ top: relativeTop - 20, behavior: 'auto' });
                    } else {
                        const offset = window.innerWidth < 640 ? 80 : 120;
                        const top = element.getBoundingClientRect().top + window.scrollY - offset;
                        window.scrollTo({ top, behavior: 'auto' });
                    }
                    setTimeout(() => { isProgrammaticScroll.current = false; }, 1000);
                }
            }, 50);
        }
    }, [activeTab]);

    const handleLocationClick = async (itemId: string) => {
        // Find which day this item (activity or stay) belongs to
        const dayWithItem = activeTrip?.days.find(d =>
            d.activities?.some(a => a.id === itemId) ||
            (d.accommodation && d.accommodation.id === itemId)
        );

        if (dayWithItem) {
            // It's a known activity or stay
            setActiveDayId(dayWithItem.id);
            setFocusedActivityId(itemId);
            setCustomMapLocation(null);

            // Switch to map tab
            setShowMap(true);
            setActiveTab('map');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Not a known ID, assume it's a raw location string (e.g. airport name)
            try {
                // Show map immediately
                setShowMap(true);
                setActiveTab('map');
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Geocode it
                const results = await geocodeLocations([itemId]);
                if (results && Object.keys(results).length > 0) {
                    const firstKey = Object.keys(results)[0];
                    setCustomMapLocation({
                        lat: results[firstKey].latitude,
                        lng: results[firstKey].longitude,
                        name: itemId
                    });
                    setFocusedActivityId(null);
                }
            } catch (error) {
                console.error("Failed to map location:", error);

                // Show user-friendly error
                let msg = "Could not find coordinates for this location.";
                if (error instanceof Error && error.message.includes("Quota")) {
                    msg = "Map search limit reached. Please try again in a minute.";
                }
                setErrorMessage(msg);
            }
        }
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
                    <p className="text-gray-500 dark:text-gray-400 mb-6">We couldn&apos;t find the trip you&apos;re looking for. It may have been deleted.</p>
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
        <DndContext sensors={sensorsMagic} onDragEnd={handleDragEndMagic}>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-20 lg:pb-0">
                {/* Header */}
                <div className="bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/60 pt-safe">
                    <div className="container mx-auto px-4 py-2 sm:py-4">
                        {/* Top row: Navigation and Actions */}
                        <div className="flex items-center justify-between mb-2 sm:mb-0">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => router.push('/trips')}
                                    className="p-1.5 -ml-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
                                    title="Back to trips"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex items-center gap-1 sm:gap-3">
                                <div className="hidden md:flex items-center gap-2 mr-2">
                                    <button
                                        onClick={() => updateWeather(tripId)}
                                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-primary-600 bg-white dark:bg-gray-800 dark:text-gray-400 dark:hover:text-primary-400 transition-all rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                                        title="Refresh weather data"
                                    >
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Weather</span>
                                    </button>
                                    <button
                                        onClick={handleSyncLocations}
                                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-800 transition-all shadow-sm"
                                        title="Auto-fix missing map coordinates"
                                    >
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>Locations</span>
                                    </button>
                                </div>

                                <DraggableMagicWand isGenerating={isMagicGenerating} />


                                <div className="flex items-center">
                                    <button
                                        onClick={() => {
                                            const newShowMap = !showMap;
                                            setShowMap(newShowMap);
                                            if (newShowMap) setActiveTab('map');
                                            else setActiveTab('itinerary');
                                        }}
                                        className={`p-1.5 sm:p-2 rounded-l-lg border border-r-0 border-gray-100 dark:border-gray-700 transition-colors flex items-center gap-1.5 ${showMap ? 'bg-primary-50 text-primary-600 border-primary-100' : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600'}`}
                                        title="Toggle Map View"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.106-1.789L9 2m6 18l5.447-2.724A2 2 0 0021 15.382V6.618a2 2 0 00-1.106-1.789L15 2m-6 18V2m6 18V2" />
                                        </svg>
                                        <span className="text-xs font-bold hidden sm:inline">Map</span>
                                    </button>
                                    <select
                                        value={mapProvider}
                                        onChange={(e) => setMapProvider(e.target.value as MapProviderKey)}
                                        className="text-[10px] sm:text-xs bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 h-[34px] sm:h-[40px] pl-1 pr-6 sm:px-2 rounded-r-lg text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:10px_6px] bg-[right_6px_center] bg-no-repeat"
                                        title="Select Map Provider"
                                    >
                                        <option value="OSM">OSM</option>
                                        <option value="AMAP">Amap</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => setIsEditTripModalOpen(true)}
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    title="Share trip"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </button>

                                <button
                                    onClick={async () => {
                                        try {
                                            const tripToExport = JSON.parse(JSON.stringify(activeTrip));
                                            const serialize = (obj: unknown): void => {
                                                if (obj && typeof obj === 'object') {
                                                    const target = obj as Record<string, unknown>;
                                                    for (const key in target) {
                                                        const val = target[key];
                                                        if (val && typeof val === 'object' && val !== null && 'seconds' in val && 'nanoseconds' in val) {
                                                            target[key] = new Date((val as { seconds: number }).seconds * 1000).toISOString();
                                                        } else if (typeof val === 'object' && val !== null) {
                                                            serialize(val);
                                                        }
                                                    }
                                                }
                                            };
                                            serialize(tripToExport);
                                            const jsonString = JSON.stringify(tripToExport, null, 2);
                                            const filename = `${(activeTrip.title || "trip").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`;

                                            const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
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
                                        } catch (err: unknown) {
                                            console.error('Export error:', err);
                                            const errorMessage = err instanceof Error ? err.message : 'Unknown error during export';
                                            alert('Error creating export file: ' + errorMessage);
                                        }
                                    }}
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    title="Export Trip"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Lower row: Info and Magic Wand */}
                        <div className="flex flex-col mt-4 gap-1">
                            {mapOverlayInfo ? (
                                /* State 1: Item Selected */
                                <div className="animate-slide-up flex flex-col gap-0.5">
                                    <h1 className="text-xl sm:text-2xl font-display font-bold text-primary-600 dark:text-primary-400 leading-tight">
                                        {mapOverlayInfo.subtitle}
                                    </h1>
                                    <div className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300">
                                        {mapOverlayInfo.fullDate || mapOverlayInfo.title}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="truncate max-w-[150px]">{activeTrip.destination}</span>
                                        </div>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>{format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}</span>
                                        </div>
                                        {/* Utility Buttons */}
                                        <div className="flex items-center gap-1 ml-auto sm:ml-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateWeather(tripId); }}
                                                className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                title="Weather"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSyncLocations(); }}
                                                className="p-1 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                title="Sync Locations"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* State 2: Default Trip Info */
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 dark:text-white leading-tight">
                                        {activeTrip.title}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="font-medium text-gray-700 dark:text-gray-300">{activeTrip.destination}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>{format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}</span>
                                        </div>
                                        {/* Utility Buttons */}
                                        <div className="flex items-center gap-1 ml-auto sm:ml-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateWeather(tripId); }}
                                                className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                title="Weather"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSyncLocations(); }}
                                                className="p-1 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                title="Sync Locations"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content - Itinerary & Map Split View */}
                <div id="itinerary-content" className={`container mx-auto transition-all duration-500 ${activeTab === 'map' ? 'p-0 max-w-none' : 'px-2 sm:px-4 py-4 sm:py-8'} ${(showMap || activeTab === 'map') ? 'max-w-none lg:px-8' : ''}`}>
                    <div className={`flex flex-col lg:flex-row ${activeTab === 'map' ? 'gap-0' : 'gap-6 sm:gap-8'} lg:h-[calc(100vh-220px)] lg:overflow-hidden`}>
                        {/* Left: Day List */}
                        <div ref={itineraryContainerRef} className={`flex-1 space-y-4 sm:space-y-6 transition-all duration-500 ${activeTab !== 'itinerary' ? 'hidden lg:block' : 'block'} ${showMap ? 'lg:w-[55%] xl:w-[60%]' : 'w-full'} lg:overflow-y-auto lg:h-full lg:pr-2 scrollbar-thin snap-y snap-mandatory`}>
                            <div className="flex items-center justify-between px-1 sm:px-0 gap-2">
                                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Itinerary</h2>

                            </div>

                            <div className="space-y-6 sm:space-y-10">
                                {processedDays && processedDays.length > 0 ? (
                                    processedDays.map((day) => (
                                        <DroppableDay key={day.id} dayId={day.id}>
                                            <div id={`day-${day.id}`} className="snap-start scroll-mt-24">
                                                <DayCard
                                                    day={day}
                                                    onAddActivity={() => handleAddActivityClick(day.id)}
                                                    onEditActivity={(activity) => handleEditActivityClick(day.id, activity)}
                                                    onToggleActivityLock={(activityId) => handleToggleActivityLock(day.id, activityId)}
                                                    onAddPhoto={() => handleAddPhotoClick(day.id)}
                                                    onRemovePhoto={(photoId) => handleRemovePhoto(day.id, photoId)}
                                                    onUndo={() => handleUndoMagic(day.id)}
                                                    showUndo={!!lastGeneratedIds[day.id]}
                                                    onOptimize={() => handleOptimizeRoute(day.id)}
                                                    onLocationClick={handleLocationClick}
                                                    onDayClick={() => {
                                                        setActiveDayId(day.id);
                                                        setFocusedActivityId(null);
                                                        setCustomMapLocation(null);
                                                    }}
                                                />
                                            </div>
                                        </DroppableDay>
                                    ))
                                ) : (
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-500 mb-2">Setting up your itinerary...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Sticky Content Pane (Map or Sidebar) */}
                        <div className={`w-full lg:w-[45%] xl:w-[40%] transition-all duration-500 ${activeTab !== 'itinerary' ? 'block' : 'hidden lg:block'} ${activeTab === 'map' ? 'p-0' : 'pb-24 lg:pb-0'} lg:h-full lg:overflow-hidden`}>
                            {showMap ? (
                                <TripMap
                                    activities={activeTrip.days.flatMap(d => (d.activities || []).map(a => ({ ...a, dayId: d.id })))}
                                    accommodations={activeTrip.days.flatMap(d => d.accommodation ? [{ ...d.accommodation, dayId: d.id }] : [])}
                                    activeDayId={activeDayId}
                                    focusedId={focusedActivityId}
                                    customLocation={customMapLocation}
                                    onMarkerClick={handleMarkerClick}
                                    provider={mapProvider}
                                    className="h-[100vh] lg:h-full w-full lg:rounded-xl overflow-hidden border-0 lg:border lg:border-gray-100 lg:dark:border-gray-700 lg:shadow-inner"
                                />
                            ) : (
                                <div className="space-y-6 overflow-y-auto h-full pr-2">
                                    {/* Transportation Sidebar */}
                                    <div id="sidebar-transportation" className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 ${activeTab === 'stay' ? 'hidden lg:block' : 'block'}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24">
                                                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                                </svg>
                                                Transportation
                                            </h3>
                                            <button onClick={handleAddTransportClick} className="text-primary-600 hover:text-primary-700 text-sm font-semibold">+ Add</button>
                                        </div>
                                        {activeTrip.transportation && activeTrip.transportation.length > 0 ? (
                                            <div className="space-y-3">
                                                {activeTrip.transportation.map((transport, idx) => (
                                                    <div key={transport.id || idx} onClick={() => handleEditTransportClick(transport)} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                                        <div className="flex justify-between items-center gap-2">
                                                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate flex-1">{transport.airline} {transport.flightNumber}</div>
                                                            <div className="text-xs font-mono text-gray-400 whitespace-nowrap flex-shrink-0">{transport.departureAirportCode} → {transport.arrivalAirportCode}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl text-gray-400 text-sm">No transfers added</div>
                                        )}
                                    </div>

                                    {/* Stays Sidebar */}
                                    <div id="sidebar-stays" className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 ${activeTab === 'transport' ? 'hidden lg:block' : 'block'}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10V6a2 2 0 012-2h14a2 2 0 012 2v4M3 20v-8a2 2 0 012-2h14a2 2 0 012 2v8M3 14h18M12 4v6" />
                                                </svg>
                                                My Stays
                                            </h3>
                                            <button onClick={handleAddAccommodationClick} className="text-primary-600 hover:text-primary-700 text-sm font-semibold">+ Add Stay</button>
                                        </div>
                                        {activeTrip.stays && activeTrip.stays.length > 0 ? (
                                            <div className="space-y-4">
                                                {activeTrip.stays.map((stay, idx) => (
                                                    <div key={stay.id || idx} onClick={() => handleEditAccommodationClick(stay)} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{stay.name}</div>
                                                        <div className="text-xs text-gray-500">{stay.checkInDate} - {stay.checkOutDate}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 text-sm italic">No stays added yet.</div>
                                        )}
                                    </div>

                                    {/* Summary Stats */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Summary</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-medium">{activeTrip.days?.length} Days</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Activities</span><span className="font-medium">{activeTrip.days?.reduce((acc, day) => acc + (day.activities?.length || 0), 0)}</span></div>
                                            <div onClick={() => setIsBudgetModalOpen(true)} className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-primary-600 font-medium cursor-pointer hover:underline">
                                                <span>View Budget</span>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Mobile Navigation */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 pb-safe">
                    <div className="flex justify-around items-center h-16 px-4">
                        <button
                            onClick={() => {
                                setShowMap(false);
                                setActiveTab('itinerary');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`flex flex-col items-center gap-1 ${activeTab === 'itinerary' ? 'text-primary-600' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-[10px] font-bold">Itinerary</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowMap(false);
                                setActiveTab('transport');
                            }}
                            className={`flex flex-col items-center gap-1 ${activeTab === 'transport' ? 'text-primary-600' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            <span className="text-[10px] font-bold">Transport</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowMap(false);
                                setActiveTab('stay');
                            }}
                            className={`flex flex-col items-center gap-1 ${activeTab === 'stay' ? 'text-primary-600' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            <span className="text-[10px] font-bold">Stay</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowMap(true);
                                setActiveTab('map');
                            }}
                            className={`flex flex-col items-center gap-1 ${activeTab === 'map' ? 'text-primary-600' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.106-1.789L9 2m6 18l5.447-2.724A2 2 0 0021 15.382V6.618a2 2 0 00-1.106-1.789L15 2m-6 18V2m6 18V2" /></svg>
                            <span className="text-[10px] font-bold">Map</span>
                        </button>
                    </div>
                </div>

                {/* Modals */}
                <AddActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} onSave={handleSaveActivity} onDelete={handleDeleteActivity} dayDate={activeDayId ? getDayDateString(activeDayId) : ''} currencyCode={currencyCode} editingActivity={editingActivity} />
                <AddTransportModal isOpen={isTransportModalOpen} onClose={() => setIsTransportModalOpen(false)} onSave={handleSaveTransport} onDelete={handleDeleteTransport} dayDateIso={startDate.toISOString().split('T')[0]} currencyCode={currencyCode} initialData={editingTransport} />
                <AddAccommodationModal isOpen={isAccommodationModalOpen} onClose={() => setIsAccommodationModalOpen(false)} onSave={handleSaveAccommodation} onDelete={handleDeleteAccommodation} dayDate="Trip Duration" dayDateIso={startDate.toISOString().split('T')[0]} currencyCode={currencyCode} initialData={editingAccommodation} />
                {activeTrip && <CreateTripModal isOpen={isEditTripModalOpen} onClose={() => setIsEditTripModalOpen(false)} tripToEdit={activeTrip} />}
                {activeTrip && <BudgetModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} trip={activeTrip} onSave={handleSaveBudget} />}
                <AddPhotoModal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} onSave={handleSavePhoto} dayDate={activeDayId ? getDayDateString(activeDayId) : ''} dayId={activeDayId || ''} />

                {/* Error Toast */}
                {errorMessage && (
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up px-4 w-full max-w-sm">
                        <div className="bg-red-50 dark:bg-red-900/90 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-sm">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium">{errorMessage}</span>
                            <button onClick={() => setErrorMessage(null)} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-full transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </DndContext >
    );
}
