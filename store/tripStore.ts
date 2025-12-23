import { create } from 'zustand';
import { Trip, DayPlan, Activity, TransportationDetails, AccommodationDetails, TripBudget } from '@/types';
import { createTrip, getUserTrips, deleteTrip, updateTrip } from '@/lib/firebase/trips';
import { useAuthStore } from './authStore';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { differenceInDays, addDays, format, parseISO } from 'date-fns';
import { fetchWeatherForDestination } from '@/lib/weather';

interface TripState {
    trips: Trip[];
    activeTrip: Trip | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchTrips: () => Promise<void>;
    getTrip: (id: string) => Promise<Trip | null>;
    addTrip: (tripData: Partial<Trip>) => Promise<void>;
    removeTrip: (tripId: string) => Promise<void>;
    setActiveTrip: (tripId: string) => void;
    initializeDays: (tripId: string) => Promise<void>;
    addActivity: (tripId: string, dayId: string, activity: Activity) => Promise<void>;
    updateActivity: (tripId: string, dayId: string, activity: Activity) => Promise<void>;
    removeActivity: (tripId: string, dayId: string, activityId: string) => Promise<void>;
    toggleActivityLock: (tripId: string, dayId: string, activityId: string) => Promise<void>;
    addTransportation: (tripId: string, transport: TransportationDetails) => Promise<void>;
    updateTransportation: (tripId: string, transport: TransportationDetails) => Promise<void>;
    removeTransportation: (tripId: string, transportId: string) => Promise<void>;
    addAccommodation: (tripId: string, accommodation: AccommodationDetails) => Promise<void>;
    updateAccommodation: (tripId: string, accommodation: AccommodationDetails) => Promise<void>;
    removeAccommodation: (tripId: string, accommodationId: string) => Promise<void>;
    toggleTripLock: (tripId: string) => Promise<void>;
    updateTripDetails: (tripId: string, updates: Partial<Trip>) => Promise<void>;
    updateTripBudget: (tripId: string, budget: TripBudget) => Promise<void>;
    importTrip: (tripData: any) => Promise<void>;
    updateDayOrder: (tripId: string, dayId: string, newOrder: string[]) => Promise<void>;
    addPhoto: (tripId: string, dayId: string, photo: any) => Promise<void>;
    removePhoto: (tripId: string, dayId: string, photoId: string) => Promise<void>;
    updateWeather: (tripId: string) => Promise<void>;
    syncGuestTrips: () => Promise<void>;
    reset: () => void;
}

const LOCAL_STORAGE_KEY = 'travel_blog_guest_trips';

// Helper to generate IDs (fallback for crypto.randomUUID)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Helper to remove undefined values for Firestore
const removeUndefined = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (obj instanceof Timestamp) return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);

    const newObj: any = {};
    for (const key in obj) {
        const value = removeUndefined(obj[key]);
        if (value !== undefined) {
            newObj[key] = value;
        }
    }
    return newObj;
};

// Helper to save to local storage
const saveToLocalStorage = (trips: Trip[], key: string = LOCAL_STORAGE_KEY) => {
    if (typeof window === 'undefined') return;

    const serializedTrips = trips.map(t => ({
        ...t,
        startDate: t.startDate.toDate().toISOString(),
        endDate: t.endDate.toDate().toISOString(),
        createdAt: t.createdAt.toDate().toISOString(),
        updatedAt: t.updatedAt.toDate().toISOString(),
        days: t.days.map(d => ({
            ...d,
            date: d.date.toDate().toISOString(),
            transportation: (d.transportation || []).map(f => ({
                ...f,
                departureTime: f.departureTime.toDate().toISOString(),
                arrivalTime: f.arrivalTime.toDate().toISOString(),
            })),
            customOrder: d.customOrder || []
        }))
    }));

    localStorage.setItem(key, JSON.stringify(serializedTrips));
};

const getUserCacheKey = (uid: string) => `travel_blog_user_cache_${uid}`;

export const useTripStore = create<TripState>((set, get) => ({
    trips: [],
    activeTrip: null,
    loading: false,
    error: null,

    fetchTrips: async () => {
        set({ loading: true, error: null });
        const user = useAuthStore.getState().user;

        try {
            if (user) {
                try {
                    const fetchedTrips = await getUserTrips();
                    set({ trips: fetchedTrips, loading: false });
                    // Cache successful fetch for offline use
                    saveToLocalStorage(fetchedTrips, getUserCacheKey(user.id));
                } catch (firestoreError: any) {
                    // If Firestore fails (e.g., offline), fall back to localStorage
                    console.warn('Firestore fetch failed, falling back to localStorage:', firestoreError.message);

                    if (typeof window !== 'undefined') {
                        // Try user-specific cache first
                        const storedTrips = localStorage.getItem(getUserCacheKey(user.id));

                        if (storedTrips) {
                            const parsedTrips = JSON.parse(storedTrips).map((trip: any) => ({
                                ...trip,
                                startDate: typeof trip.startDate === 'string' ? Timestamp.fromDate(new Date(trip.startDate)) : trip.startDate,
                                endDate: typeof trip.endDate === 'string' ? Timestamp.fromDate(new Date(trip.endDate)) : trip.endDate,
                                createdAt: typeof trip.createdAt === 'string' ? Timestamp.fromDate(new Date(trip.createdAt)) : trip.createdAt,
                                updatedAt: typeof trip.updatedAt === 'string' ? Timestamp.fromDate(new Date(trip.updatedAt)) : trip.updatedAt,
                                days: (trip.days || []).map((d: any) => ({
                                    ...d,
                                    date: typeof d.date === 'string' ? Timestamp.fromDate(new Date(d.date)) : d.date,
                                    transportation: (d.transportation || d.flights || []).map((f: any) => ({
                                        ...f,
                                        departureTime: typeof f.departureTime === 'string' ? Timestamp.fromDate(new Date(f.departureTime)) : f.departureTime,
                                        arrivalTime: typeof f.arrivalTime === 'string' ? Timestamp.fromDate(new Date(f.arrivalTime)) : f.arrivalTime,
                                    })),
                                    accommodation: d.accommodation || undefined
                                }))
                            }));
                            set({
                                trips: parsedTrips,
                                loading: false,
                                error: 'Offline mode - showing cached trips'
                            });
                        } else {
                            // Only checks guest cache as a desperate last resort, usually irrelevant for logged in users
                            set({
                                trips: [],
                                loading: false,
                                error: `Connection Error: ${firestoreError.message || 'Unknown error'}. No cached trips available.`
                            });
                        }
                    } else {
                        throw firestoreError; // Re-throw on server side
                    }
                }
            } else {
                if (typeof window !== 'undefined') {
                    const storedTrips = localStorage.getItem(LOCAL_STORAGE_KEY);
                    if (storedTrips) {
                        const parsedTrips = JSON.parse(storedTrips).map((trip: any) => ({
                            ...trip,
                            startDate: typeof trip.startDate === 'string' ? Timestamp.fromDate(new Date(trip.startDate)) : trip.startDate,
                            endDate: typeof trip.endDate === 'string' ? Timestamp.fromDate(new Date(trip.endDate)) : trip.endDate,
                            createdAt: typeof trip.createdAt === 'string' ? Timestamp.fromDate(new Date(trip.createdAt)) : trip.createdAt,
                            updatedAt: typeof trip.updatedAt === 'string' ? Timestamp.fromDate(new Date(trip.updatedAt)) : trip.updatedAt,
                            days: (trip.days || []).map((d: any) => ({
                                ...d,
                                date: typeof d.date === 'string' ? Timestamp.fromDate(new Date(d.date)) : d.date,
                                transportation: (d.transportation || d.flights || []).map((f: any) => ({
                                    ...f,
                                    departureTime: typeof f.departureTime === 'string' ? Timestamp.fromDate(new Date(f.departureTime)) : f.departureTime,
                                    arrivalTime: typeof f.arrivalTime === 'string' ? Timestamp.fromDate(new Date(f.arrivalTime)) : f.arrivalTime,
                                })),
                                accommodation: d.accommodation || undefined
                            }))
                        }));
                        set({ trips: parsedTrips, loading: false });
                    } else {
                        set({ trips: [], loading: false });
                    }
                } else {
                    set({ trips: [], loading: false });
                }
            }
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    },

    getTrip: async (id: string) => {
        const existingTrip = get().trips.find(t => t.id === id);
        if (existingTrip) {
            get().setActiveTrip(id);
            return existingTrip;
        }

        await get().fetchTrips();
        const fetchedTrip = get().trips.find(t => t.id === id);
        if (fetchedTrip) {
            get().setActiveTrip(id);
            return fetchedTrip;
        }
        return null;
    },

    addTrip: async (tripData) => {
        set({ loading: true, error: null });
        const user = useAuthStore.getState().user;

        try {
            if (user) {
                const newTrip = await createTrip(tripData);
                set((state) => ({
                    trips: [newTrip, ...state.trips],
                    loading: false
                }));
            } else {
                if (typeof window !== 'undefined') {
                    const newTrip: Trip = {
                        id: generateId(),
                        userId: 'guest',
                        title: tripData.title || 'Untitled Trip',
                        destination: tripData.destination || 'Unknown',
                        startDate: tripData.startDate as Timestamp,
                        endDate: tripData.endDate as Timestamp,
                        budget: tripData.budget || {
                            totalBudget: 0,
                            currency: 'USD',
                            categories: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 },
                            actualSpending: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 }
                        },
                        collaborators: [],
                        isPublic: false,
                        status: 'draft',
                        days: [],
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        ...tripData
                    } as Trip;

                    const updatedTrips = [newTrip, ...get().trips];
                    saveToLocalStorage(updatedTrips);
                    set({ trips: updatedTrips, loading: false });
                }
            }
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    },

    removeTrip: async (tripId) => {
        set({ loading: true, error: null });
        const user = useAuthStore.getState().user;

        try {
            if (user) {
                await deleteTrip(tripId);
                set((state) => ({
                    trips: state.trips.filter((t) => t.id !== tripId),
                    loading: false,
                }));
            } else {
                if (typeof window !== 'undefined') {
                    const updatedTrips = get().trips.filter(t => t.id !== tripId);
                    saveToLocalStorage(updatedTrips);
                    set({ trips: updatedTrips, loading: false });
                }
            }
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    },

    setActiveTrip: (tripId) => {
        const trip = get().trips.find((t) => t.id === tripId);
        set({ activeTrip: trip || null });
    },

    initializeDays: async (tripId) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        if (trip.days && trip.days.length > 0) return;

        // Normalize to midnight to ensure correct exclusive day count regardless of time
        const start = trip.startDate.toDate();
        start.setHours(0, 0, 0, 0);

        const end = trip.endDate.toDate();
        end.setHours(0, 0, 0, 0);

        // differenceInDays returns integer days. 
        // Example: Jan 1 to Jan 2 is 1 day diff. We want 2 days (Jan 1, Jan 2). So +1.
        const dayCount = differenceInDays(end, start) + 1;

        const days: DayPlan[] = [];

        for (let i = 0; i < dayCount; i++) {
            const date = addDays(start, i);
            days.push({
                id: generateId(),
                tripId: trip.id,
                date: Timestamp.fromDate(date),
                dayNumber: i + 1,
                transportation: [],
                activities: [],
                dining: [],
                dailyBudget: 0,
                notes: '',
                photos: [],
                isCompleted: false
            });
        }

        const updatedTrip = { ...trip, days };
        const user = useAuthStore.getState().user;

        if (user) {
            await updateTrip(trip.id, { days });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    addActivity: async (tripId, dayId, activity) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedDays = trip.days.map(day => {
            if (day.id === dayId) {
                return {
                    ...day,
                    activities: [...day.activities, activity]
                };
            }
            return day;
        });

        // Update Budget
        const newSpending = { ...trip.budget.actualSpending };
        newSpending.activities = (newSpending.activities || 0) + (activity.cost || 0);

        const updatedTrip = {
            ...trip,
            days: updatedDays,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            }
        };
        const user = useAuthStore.getState().user;

        if (user) {
            await updateTrip(trip.id, {
                days: updatedDays,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    updateActivity: async (tripId, dayId, activity) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;

        const oldActivity = day.activities.find(a => a.id === activity.id);
        const costDiff = (activity.cost || 0) - (oldActivity?.cost || 0);

        const updatedDays = trip.days.map(d => {
            if (d.id === dayId) {
                return {
                    ...d,
                    activities: d.activities.map(a => a.id === activity.id ? activity : a)
                };
            }
            return d;
        });

        const newSpending = { ...trip.budget.actualSpending };
        newSpending.activities = (newSpending.activities || 0) + costDiff;

        const updatedTrip = {
            ...trip,
            days: updatedDays,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            }
        };

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                days: updatedDays,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    removeActivity: async (tripId, dayId, activityId) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;

        const activityToRemove = day.activities.find(a => a.id === activityId);
        const costToRemove = activityToRemove?.cost || 0;

        const updatedDays = trip.days.map(d => {
            if (d.id === dayId) {
                return {
                    ...d,
                    activities: d.activities.filter(a => a.id !== activityId),
                    customOrder: d.customOrder?.filter(id => id !== activityId)
                };
            }
            return d;
        });

        const newSpending = { ...trip.budget.actualSpending };
        newSpending.activities = Math.max(0, (newSpending.activities || 0) - costToRemove);

        const updatedTrip = {
            ...trip,
            days: updatedDays,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            }
        };

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                days: updatedDays,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    toggleActivityLock: async (tripId, dayId, activityId) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedDays = trip.days.map(day => {
            if (day.id === dayId) {
                return {
                    ...day,
                    activities: day.activities.map(a =>
                        a.id === activityId ? { ...a, isLocked: !a.isLocked } : a
                    )
                };
            }
            return day;
        });

        const updatedTrip = { ...trip, days: updatedDays };
        const user = useAuthStore.getState().user;

        if (user) {
            await updateTrip(trip.id, { days: updatedDays });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    addTransportation: async (tripId, transport) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // 1. Add to central "transportation" list
        const updatedTransportation = [...(trip.transportation || []), transport];

        // 2. Update Budget
        const newSpending = { ...trip.budget.actualSpending };
        if (transport.type === 'flight') {
            newSpending.flights = (newSpending.flights || 0) + (transport.cost || 0);
        } else {
            newSpending.transportation = (newSpending.transportation || 0) + (transport.cost || 0);
        }

        const updatedTrip = {
            ...trip,
            transportation: updatedTransportation,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            },
            updatedAt: Timestamp.now()
        };

        // Update state immediately (optimistic)
        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                transportation: updatedTransportation,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }
    },

    updateTransportation: async (tripId, transport) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // 1. Update central "transportation" list
        const updatedTransportation = (trip.transportation || []).map(f => f.id === transport.id ? transport : f);

        // Calculate Cost Difference
        const oldTransport = (trip.transportation || []).find(f => f.id === transport.id);
        const costDiff = (transport.cost || 0) - (oldTransport?.cost || 0);

        // 2. Update Budget
        const newSpending = { ...trip.budget.actualSpending };
        if (transport.type === 'flight') {
            newSpending.flights = (newSpending.flights || 0) + costDiff;
        } else {
            newSpending.transportation = (newSpending.transportation || 0) + costDiff;
        }

        const updatedTrip = {
            ...trip,
            transportation: updatedTransportation,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            },
            updatedAt: Timestamp.now()
        };

        // Update state immediately (optimistic)
        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                transportation: updatedTransportation,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }
    },

    removeTransportation: async (tripId, transportId) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // 1. Update list
        const updatedTransportation = (trip.transportation || []).filter(f => f.id !== transportId);

        // Cost removal
        const transportToRemove = (trip.transportation || []).find(f => f.id === transportId);
        const costToRemove = transportToRemove?.cost || 0;

        // 2. Update Budget
        const newSpending = { ...trip.budget.actualSpending };
        if (transportToRemove?.type === 'flight') {
            newSpending.flights = Math.max(0, (newSpending.flights || 0) - costToRemove);
        } else {
            newSpending.transportation = Math.max(0, (newSpending.transportation || 0) - costToRemove);
        }

        const updatedTrip = {
            ...trip,
            transportation: updatedTransportation,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            },
            updatedAt: Timestamp.now()
        };

        // Update state immediately (optimistic)
        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                transportation: updatedTransportation,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }
    },

    addAccommodation: async (tripId, accommodation) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // 1. Add to central "stays" list
        const updatedStays = [...(trip.stays || []), accommodation];

        // 2. Propagate to relevant days
        // Logic: logic: Where Do I Sleep? 
        // A stay from Dec 25 (CheckIn) to Dec 28 (CheckOut) implies sleeping on nights of 25, 26, 27.
        // It does NOT imply sleeping on the 28th (that's check-out day).

        const checkIn = new Date(accommodation.checkInDate || '');
        const checkOut = new Date(accommodation.checkOutDate || '');

        const updatedDays = trip.days.map(day => {
            // Robust Date Comparison Logic
            // Parse YYYY-MM-DD strings explicitly to local midnight dates to avoid UTC issues
            const parseYMD = (ymd: string): Date | null => {
                if (!ymd) return null;
                const parts = ymd.split('-');
                if (parts.length !== 3) return null;
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            };

            const dayDate = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);

            const checkInDate = parseYMD(accommodation.checkInDate || '');
            const checkOutDate = parseYMD(accommodation.checkOutDate || '');

            let newDay = { ...day };

            if (checkInDate && checkOutDate) {
                // 1. Staying (Inclusive start, Exclusive end)
                if (dayDate.getTime() >= checkInDate.getTime() && dayDate.getTime() < checkOutDate.getTime()) {
                    newDay.accommodation = accommodation;
                }

                // 2. Checkout (Exact match)
                if (dayDate.getTime() === checkOutDate.getTime()) {
                    newDay.accommodationCheckout = accommodation;
                }
            }

            return newDay;
        });

        // 3. Update Budget (Add once, not per day)
        // Note: If we added cost to the DayPlan, we might double count if we sum days.
        // The budget calculation needs to be smart.
        // For this iteration, we add the TOTAL cost to the budget.
        const newTotal = (trip.budget.totalBudget || 0); // User might manually update
        const newSpending = { ...trip.budget.actualSpending };
        newSpending.accommodation = (newSpending.accommodation || 0) + (accommodation.cost || 0);

        const updatedTrip = {
            ...trip,
            stays: updatedStays,
            days: updatedDays,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            },
            updatedAt: Timestamp.now()
        };

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                stays: updatedStays,
                days: updatedDays,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    updateAccommodation: async (tripId, accommodation) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // 1. Update central "stays" list
        // Replace the old stay with the new one
        const updatedStays = (trip.stays || []).map(s => s.id === accommodation.id ? accommodation : s);

        // Calculate Cost Difference for Budget
        const oldStay = (trip.stays || []).find(s => s.id === accommodation.id);
        const costDiff = (accommodation.cost || 0) - (oldStay?.cost || 0);

        // 2. Re-propagate to relevant days
        // STRATEGY: 
        // A. Clear this accommodation from ALL days (it might have moved dates).
        // B. Re-apply it using the new dates.

        // Step A: Clear logic
        let tempDays = trip.days.map(day => {
            let newDay = { ...day };
            if (newDay.accommodation?.id === accommodation.id) {
                newDay.accommodation = undefined;
            }
            if (newDay.accommodationCheckout?.id === accommodation.id) {
                newDay.accommodationCheckout = undefined;
            }
            return newDay;
        });

        // Step B: Re-apply logic (Same as addAccommodation)
        const checkIn = new Date(accommodation.checkInDate || '');
        const checkOut = new Date(accommodation.checkOutDate || '');

        const updatedDays = tempDays.map(day => {
            // Robust Date Comparison Logic
            const parseYMD = (ymd: string): Date | null => {
                if (!ymd) return null;
                const parts = ymd.split('-');
                if (parts.length !== 3) return null;
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            };

            const dayDate = day.date instanceof Timestamp ? day.date.toDate() : new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);

            const checkInDate = parseYMD(accommodation.checkInDate || '');
            const checkOutDate = parseYMD(accommodation.checkOutDate || '');

            let newDay = { ...day };

            if (checkInDate && checkOutDate) {
                // 1. Staying (Inclusive start, Exclusive end)
                if (dayDate.getTime() >= checkInDate.getTime() && dayDate.getTime() < checkOutDate.getTime()) {
                    newDay.accommodation = accommodation;
                }

                // 2. Checkout (Exact match)
                if (dayDate.getTime() === checkOutDate.getTime()) {
                    newDay.accommodationCheckout = accommodation;
                }
            }

            return newDay;
        });

        // 3. Update Budget
        const newSpending = { ...trip.budget.actualSpending };
        newSpending.accommodation = (newSpending.accommodation || 0) + costDiff;

        const updatedTrip = {
            ...trip,
            stays: updatedStays,
            days: updatedDays,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            },
            updatedAt: Timestamp.now()
        };

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                stays: updatedStays,
                days: updatedDays,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    removeAccommodation: async (tripId, accommodationId) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // 1. Update central "stays" list
        const updatedStays = (trip.stays || []).filter(s => s.id !== accommodationId);

        // Calculate Cost to Remove for Budget
        const stayToRemove = (trip.stays || []).find(s => s.id === accommodationId);
        const costToRemove = stayToRemove?.cost || 0;

        // 2. Clear from relevant days
        const updatedDays = trip.days.map(day => {
            let newDay = { ...day };
            if (newDay.accommodation?.id === accommodationId) {
                newDay.accommodation = undefined;
            }
            if (newDay.accommodationCheckout?.id === accommodationId) {
                newDay.accommodationCheckout = undefined;
            }
            return newDay;
        });

        // 3. Update Budget
        const newSpending = { ...trip.budget.actualSpending };
        newSpending.accommodation = Math.max(0, (newSpending.accommodation || 0) - costToRemove);

        const updatedTrip = {
            ...trip,
            stays: updatedStays,
            days: updatedDays,
            budget: {
                ...trip.budget,
                actualSpending: newSpending
            },
            updatedAt: Timestamp.now()
        };

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, {
                stays: updatedStays,
                days: updatedDays,
                budget: updatedTrip.budget
            });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    toggleTripLock: async (tripId: string) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedTrip = { ...trip, isLocked: !trip.isLocked };
        const user = useAuthStore.getState().user;

        if (user) {
            await updateTrip(trip.id, { isLocked: updatedTrip.isLocked });
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    updateTripDetails: async (tripId, updates) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        // Merge updates. Special handling might be needed for dates if they change significantly (re-init days?), 
        // but for now we just update top-level metadata.
        const updatedTrip = { ...trip, ...updates, updatedAt: Timestamp.now() };

        // If dates changed, we might want to check days logic, but keeping it simple for now:
        // just update the trip metadata. The days array remains as is unless explicitly cleared.

        const user = useAuthStore.getState().user;

        if (user) {
            await updateTrip(tripId, updates);
        } else {
            const updatedTrips = get().trips.map(t => t.id === tripId ? updatedTrip : t);
            saveToLocalStorage(updatedTrips);
        }

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));
    },

    importTrip: async (tripData: any) => {
        set({ loading: true, error: null });
        const user = useAuthStore.getState().user;

        try {
            // Basic validation and transformation
            const newTripId = generateId();
            const now = Timestamp.now();

            // Helper to safe convert date string to Timestamp
            const toTimestamp = (dateStr: string | any) => {
                if (!dateStr) return now;
                if (dateStr instanceof Timestamp) return dateStr;
                try {
                    return Timestamp.fromDate(new Date(dateStr));
                } catch (e) {
                    return now;
                }
            };

            // Helper to strict sanitize Location
            const sanitizeLocation = (loc: any) => ({
                name: loc?.name || 'Unknown',
                address: loc?.address || '',
                city: loc?.city || '',
                country: loc?.country || '',
                countryCode: loc?.countryCode || '',
                latitude: Number(loc?.latitude) || 0,
                longitude: Number(loc?.longitude) || 0,
                placeId: loc?.placeId || '',
                notes: loc?.notes || ''
            });

            const importedTrip: Trip = {
                // Whitelist fields to avoid 'Missing or insufficient permissions' from extra fields in JSON
                id: newTripId,
                userId: user ? user.id : 'guest',
                title: tripData.title || 'Imported Trip',
                destination: tripData.destination || 'Unknown',
                coverPhoto: tripData.coverPhoto,
                startDate: toTimestamp(tripData.startDate),
                endDate: toTimestamp(tripData.endDate),
                budget: {
                    totalBudget: Number(tripData.budget?.totalBudget) || 0,
                    currency: tripData.budget?.currency || 'USD',
                    categories: {
                        flights: Number(tripData.budget?.categories?.flights) || 0,
                        accommodation: Number(tripData.budget?.categories?.accommodation) || 0,
                        food: Number(tripData.budget?.categories?.food) || 0,
                        activities: Number(tripData.budget?.categories?.activities) || 0,
                        shopping: Number(tripData.budget?.categories?.shopping) || 0,
                        transportation: Number(tripData.budget?.categories?.transportation) || 0,
                        other: Number(tripData.budget?.categories?.other) || 0,
                    },
                    actualSpending: {
                        flights: Number(tripData.budget?.actualSpending?.flights) || 0,
                        accommodation: Number(tripData.budget?.actualSpending?.accommodation) || 0,
                        food: Number(tripData.budget?.actualSpending?.food) || 0,
                        activities: Number(tripData.budget?.actualSpending?.activities) || 0,
                        shopping: Number(tripData.budget?.actualSpending?.shopping) || 0,
                        transportation: Number(tripData.budget?.actualSpending?.transportation) || 0,
                        other: Number(tripData.budget?.actualSpending?.other) || 0,
                    },
                    dailyLimit: Number(tripData.budget?.dailyLimit) || 0
                },
                stays: (tripData.stays || []).map((s: any) => ({
                    id: generateId(),
                    name: s.name || 'Unknown Stay',
                    type: s.type || 'other',
                    address: s.address || '',
                    location: sanitizeLocation(s.location),
                    checkInTime: s.checkInTime || '',
                    checkOutTime: s.checkOutTime || '',
                    cost: Number(s.cost) || 0,
                    currency: s.currency || 'USD',
                    bookingConfirmation: s.bookingConfirmation || '',
                    amenities: s.amenities || [],
                    imageUrl: s.imageUrl,
                    color: s.color
                })),
                transportation: (tripData.transportation || []).map((f: any) => ({
                    id: generateId(),
                    type: f.type || 'other',
                    airline: f.airline || '',
                    flightNumber: f.flightNumber || '',
                    departureAirport: f.departureAirport || '',
                    departureAirportCode: f.departureAirportCode || '',
                    departureTime: toTimestamp(f.departureTime),
                    arrivalAirport: f.arrivalAirport || '',
                    arrivalAirportCode: f.arrivalAirportCode || '',
                    arrivalTime: toTimestamp(f.arrivalTime),
                    bookingReference: f.bookingReference || '',
                    cost: Number(f.cost) || 0,
                    currency: f.currency || 'USD',
                    notes: f.notes || ''
                })),
                collaborators: [],
                isPublic: false,
                status: 'draft',
                createdAt: now,
                updatedAt: now,
                days: (tripData.days || []).map((day: any) => ({
                    id: generateId(),
                    tripId: newTripId,
                    date: toTimestamp(day.date),
                    dayNumber: Number(day.dayNumber) || 0,
                    dailyBudget: Number(day.dailyBudget) || 0,
                    notes: day.notes || '',
                    isCompleted: day.isCompleted || false,

                    // Strictly reconstruct nested Arrays
                    transportation: (day.transportation || day.flights || []).map((f: any) => ({
                        id: generateId(),
                        type: f.type || 'other',
                        airline: f.airline || '',
                        flightNumber: f.flightNumber || '',
                        departureAirport: f.departureAirport || '',
                        departureAirportCode: f.departureAirportCode || '',
                        departureTime: toTimestamp(f.departureTime),
                        arrivalAirport: f.arrivalAirport || '',
                        arrivalAirportCode: f.arrivalAirportCode || '',
                        arrivalTime: toTimestamp(f.arrivalTime),
                        bookingReference: f.bookingReference || '',
                        cost: Number(f.cost) || 0,
                        currency: f.currency || 'USD',
                        notes: f.notes || ''
                    })),

                    activities: (day.activities || []).map((a: any) => ({
                        id: generateId(),
                        type: a.type || 'other',
                        name: a.name || 'Untitled Activity',
                        description: a.description || '',
                        startTime: a.startTime || '',
                        endTime: a.endTime || '',
                        cost: Number(a.cost) || 0,
                        currency: a.currency || 'USD',
                        location: sanitizeLocation(a.location),
                        bookingRequired: a.bookingRequired || false,
                        notes: a.notes || '',
                        photos: [],
                        imageUrl: a.imageUrl
                    })),

                    accommodation: day.accommodation ? {
                        id: generateId(),
                        name: day.accommodation.name || 'Unknown Stay',
                        type: day.accommodation.type || 'other',
                        address: day.accommodation.address || '',
                        location: sanitizeLocation(day.accommodation.location),
                        checkInTime: day.accommodation.checkInTime || '',
                        checkOutTime: day.accommodation.checkOutTime || '',
                        cost: Number(day.accommodation.cost) || 0,
                        currency: day.accommodation.currency || 'USD',
                        bookingConfirmation: day.accommodation.bookingConfirmation || '',
                        amenities: day.accommodation.amenities || [],
                        imageUrl: day.accommodation.imageUrl,
                        color: day.accommodation.color
                    } : undefined,

                    dining: [], // Reset dining for simplicity or strict map if needed
                    photos: []
                }))
            };

            if (user) {
                const sanitizedTrip = removeUndefined(importedTrip);
                const newTrip = await createTrip(sanitizedTrip);
                set((state) => ({
                    trips: [newTrip, ...state.trips],
                    loading: false
                }));
            } else {
                if (typeof window !== 'undefined') {
                    const updatedTrips = [importedTrip, ...get().trips];
                    saveToLocalStorage(updatedTrips);
                    set({ trips: updatedTrips, loading: false });
                }
            }
        } catch (error: any) {
            console.error('Import failed', error);
            set({ error: 'Failed to import trip: ' + error.message, loading: false });
        }
    },

    updateDayOrder: async (tripId, dayId, newOrder) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedDays = (trip.days || []).map(day =>
            day.id === dayId ? { ...day, customOrder: newOrder } : day
        );

        const updatedTrip = {
            ...trip,
            days: updatedDays,
            updatedAt: Timestamp.now()
        };

        // Update state immediately (optimistic)
        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(trip.id, { days: updatedDays });
        } else {
            saveToLocalStorage(get().trips);
        }
    },

    updateTripBudget: async (tripId, budget) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedTrip = { ...trip, budget, updatedAt: Timestamp.now() };

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(tripId, { budget });
        } else {
            saveToLocalStorage(get().trips);
        }
    },

    addPhoto: async (tripId, dayId, photo) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedDays = (trip.days || []).map(day => {
            if (day.id === dayId) {
                return {
                    ...day,
                    photos: [...(day.photos || []), photo]
                };
            }
            return day;
        });

        const updatedTrip = {
            ...trip,
            days: updatedDays,
            updatedAt: Timestamp.now()
        };

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(tripId, { days: updatedDays });
        } else {
            saveToLocalStorage(get().trips);
        }
    },

    removePhoto: async (tripId, dayId, photoId) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip) return;

        const updatedDays = (trip.days || []).map(day => {
            if (day.id === dayId) {
                return {
                    ...day,
                    photos: (day.photos || []).filter(p => p.id !== photoId)
                };
            }
            return day;
        });

        const updatedTrip = {
            ...trip,
            days: updatedDays,
            updatedAt: Timestamp.now()
        };

        set(state => ({
            trips: state.trips.map(t => t.id === tripId ? updatedTrip : t),
            activeTrip: state.activeTrip?.id === tripId ? updatedTrip : state.activeTrip
        }));

        const user = useAuthStore.getState().user;
        if (user) {
            await updateTrip(tripId, { days: updatedDays });
        } else {
            saveToLocalStorage(get().trips);
        }
    },

    updateWeather: async (tripId: string) => {
        const trip = get().trips.find(t => t.id === tripId);
        if (!trip || !trip.destination) return;

        try {
            const dates = trip.days.map(d => {
                const date = (d.date as any)?.toDate ? (d.date as any).toDate() :
                    (d.date as any)?.seconds ? new Date((d.date as any).seconds * 1000) :
                        new Date(d.date as any);
                return format(date, 'yyyy-MM-dd');
            });

            const weatherData = await fetchWeatherForDestination(trip.destination, dates);

            const updatedDays = (trip.days || []).map(day => {
                const date = (day.date as any)?.toDate ? (day.date as any).toDate() :
                    (day.date as any)?.seconds ? new Date((day.date as any).seconds * 1000) :
                        new Date(day.date as any);
                const dateKey = format(date, 'yyyy-MM-dd');

                if (weatherData[dateKey]) {
                    return { ...day, weather: weatherData[dateKey] };
                }
                return day;
            });

            await get().updateTripDetails(tripId, { days: updatedDays });
        } catch (error) {
            console.error('Failed to update weather:', error);
        }
    },

    syncGuestTrips: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const storedTrips = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!storedTrips) return;

        try {
            const guestTrips = JSON.parse(storedTrips);
            if (guestTrips.length === 0) return;

            set({ loading: true });

            // First, try to fetch existing trips from Firestore
            // If offline or connection fails, we'll create all trips without checking for duplicates
            let existingTrips: Trip[] = [];
            try {
                existingTrips = await getUserTrips();
            } catch (fetchError: any) {
                console.warn('Could not fetch existing trips (possibly offline). Will create all guest trips:', fetchError.message);
                // Continue with empty existingTrips array - will create all trips
            }


            let syncedTripIds: string[] = [];
            let failedTrips: any[] = [];

            for (const trip of guestTrips) {
                try {
                    // Remove ID so Firebase generates a new one
                    const { id, ...tripData } = trip;

                    // Convert string dates back to Timestamps if needed
                    const startDate = typeof trip.startDate === 'string' ? Timestamp.fromDate(new Date(trip.startDate)) : trip.startDate;
                    const endDate = typeof trip.endDate === 'string' ? Timestamp.fromDate(new Date(trip.endDate)) : trip.endDate;

                    // Check if a similar trip already exists in Firestore
                    // Match by title, destination, and date range
                    const existingTrip = existingTrips.find(existing => {
                        const existingStart = existing.startDate instanceof Timestamp ? existing.startDate : Timestamp.fromDate(new Date(existing.startDate as any));
                        const existingEnd = existing.endDate instanceof Timestamp ? existing.endDate : Timestamp.fromDate(new Date(existing.endDate as any));

                        return existing.title === trip.title &&
                            existing.destination === trip.destination &&
                            existingStart.toMillis() === startDate.toMillis() &&
                            existingEnd.toMillis() === endDate.toMillis();
                    });

                    if (existingTrip) {
                        // Trip already exists - merge data if guest version has more details
                        console.log(`Trip "${trip.title}" already exists in Firestore. Merging data...`);

                        // Only update if guest trip has more days/activities/data
                        const guestHasMoreData = (trip.days?.length || 0) > (existingTrip.days?.length || 0) ||
                            (trip.transportation?.length || 0) > (existingTrip.transportation?.length || 0) ||
                            (trip.stays?.length || 0) > (existingTrip.stays?.length || 0);

                        if (guestHasMoreData) {
                            const formattedTrip = {
                                ...tripData,
                                startDate,
                                endDate,
                                days: (trip.days || []).map((d: any) => ({
                                    ...d,
                                    date: typeof d.date === 'string' ? Timestamp.fromDate(new Date(d.date)) : d.date,
                                    transportation: (d.transportation || []).map((f: any) => ({
                                        ...f,
                                        departureTime: typeof f.departureTime === 'string' ? Timestamp.fromDate(new Date(f.departureTime)) : f.departureTime,
                                        arrivalTime: typeof f.arrivalTime === 'string' ? Timestamp.fromDate(new Date(f.arrivalTime)) : f.arrivalTime,
                                    }))
                                }))
                            };

                            await updateTrip(existingTrip.id, formattedTrip);
                            console.log(`Updated existing trip "${trip.title}" with guest data.`);
                        } else {
                            console.log(`Keeping existing Firestore version of "${trip.title}" (has equal or more data).`);
                        }
                        syncedTripIds.push(id);
                    } else {
                        // Trip doesn't exist - create new one
                        const formattedTrip = {
                            ...tripData,
                            startDate,
                            endDate,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            days: (trip.days || []).map((d: any) => ({
                                ...d,
                                date: typeof d.date === 'string' ? Timestamp.fromDate(new Date(d.date)) : d.date,
                                transportation: (d.transportation || []).map((f: any) => ({
                                    ...f,
                                    departureTime: typeof f.departureTime === 'string' ? Timestamp.fromDate(new Date(f.departureTime)) : f.departureTime,
                                    arrivalTime: typeof f.arrivalTime === 'string' ? Timestamp.fromDate(new Date(f.arrivalTime)) : f.arrivalTime,
                                }))
                            }))
                        };

                        await createTrip(formattedTrip);
                        console.log(`Created new trip "${trip.title}" in Firestore.`);
                        syncedTripIds.push(id);
                    }
                } catch (tripError: any) {
                    console.error(`Failed to sync trip "${trip.title}":`, tripError.message);
                    failedTrips.push(trip);
                }
            }

            // Only clear successfully synced trips from local storage
            if (failedTrips.length > 0) {
                console.warn(`${failedTrips.length} trip(s) failed to sync. Keeping them in localStorage for retry.`);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(failedTrips));
                set({
                    error: `Synced ${syncedTripIds.length} trip(s). ${failedTrips.length} trip(s) will retry when online.`,
                    loading: false
                });
            } else {
                // All trips synced successfully - clear local storage
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                console.log('All guest trips synced successfully!');
                set({ loading: false });
            }

            // Fetch updated trips from Firestore
            await get().fetchTrips();

        } catch (error: any) {
            console.error('Failed to sync trips:', error);
            set({ error: error.message, loading: false });
        }
    },

    reset: () => set({ trips: [], activeTrip: null, error: null }),
}));
