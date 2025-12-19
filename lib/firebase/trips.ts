import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db, auth } from './config';
import { Trip } from '@/types';

const ensureInitialized = () => {
    if (!db || !auth) {
        throw new Error('Firebase credentials missing. Feature unavailable in guest mode.');
    }
    return { db, auth };
};

// Helper to get collection ref safely
const getTripsCollection = () => {
    const { db } = ensureInitialized();
    return collection(db, 'trips');
};

// Create a new trip
export const createTrip = async (tripData: Partial<Trip>): Promise<Trip> => {
    const { auth } = ensureInitialized();
    const user = auth.currentUser;

    if (!user) {
        throw new Error('User must be logged in to create a trip');
    }

    const newTripData = {
        ...tripData,
        userId: user.uid,
        collaborators: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(getTripsCollection(), newTripData);

    // Return the created trip with ID and solved timestamps (approximated for immediate UI update)
    return {
        id: docRef.id,
        ...newTripData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    } as Trip;
};

// Get all trips for the current user
export const getUserTrips = async (): Promise<Trip[]> => {
    const { auth } = ensureInitialized();
    const user = auth.currentUser;

    if (!user) {
        return [];
    }

    const q = query(
        getTripsCollection(),
        where('userId', '==', user.uid),
        orderBy('startDate', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Trip[];
};

// Get a single trip by ID
export const getTripById = async (tripId: string): Promise<Trip | null> => {
    const { db } = ensureInitialized();
    const docRef = doc(db, 'trips', tripId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Trip;
    } else {
        return null;
    }
};

// Update a trip
export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
    const { db } = ensureInitialized();
    const docRef = doc(db, 'trips', tripId);

    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
};

// Delete a trip
export const deleteTrip = async (tripId: string): Promise<void> => {
    const { db } = ensureInitialized();
    const docRef = doc(db, 'trips', tripId);
    await deleteDoc(docRef);
};
