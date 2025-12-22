import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    OAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { User } from '@/types';

// Helper to check initialization
const ensureInitialized = () => {
    if (!auth || !db) {
        throw new Error('Firebase credentials missing. Feature unavailable in guest mode.');
    }
    return { auth, db };
};

// Sign up with email and password
export const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string
): Promise<User> => {
    const { auth, db } = ensureInitialized();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Update profile with display name
        await updateProfile(firebaseUser, { displayName });

        // Create user document in Firestore
        const newUser: Omit<User, 'id'> = {
            email: firebaseUser.email!,
            displayName,
            photoURL: firebaseUser.photoURL || undefined,
            bio: '',
            createdAt: serverTimestamp() as unknown as Timestamp,
            updatedAt: serverTimestamp() as unknown as Timestamp,
            stats: {
                postsCount: 0,
                followersCount: 0,
                followingCount: 0,
                tripsCount: 0,
                countriesVisited: 0,
            },
            preferences: {
                theme: 'system',
                notifications: true,
                emailNotifications: true,
                privacy: 'public',
            },
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);

        return { id: firebaseUser.uid, ...newUser } as User;
    } catch (error: unknown) {
        throw new Error((error as Error).message || 'Failed to sign up');
    }
};

// Sign in with email and password
export const signInWithEmail = async (
    email: string,
    password: string
): Promise<User> => {
    const { auth, db } = ensureInitialized();
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Get user document from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (!userDoc.exists()) {
            throw new Error('User data not found');
        }

        return { id: firebaseUser.uid, ...userDoc.data() } as User;
    } catch (error: unknown) {
        throw new Error((error as Error).message || 'Failed to sign in');
    }
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
    const { auth, db } = ensureInitialized();
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;

    // Try to get/create Firestore document, but don't fail if offline
    try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (userDoc.exists()) {
            return { id: firebaseUser.uid, ...userDoc.data() } as User;
        }

        // Create new user document
        const newUser: Omit<User, 'id'> = {
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || 'Anonymous',
            photoURL: firebaseUser.photoURL || undefined,
            bio: '',
            createdAt: serverTimestamp() as unknown as Timestamp,
            updatedAt: serverTimestamp() as unknown as Timestamp,
            stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
            preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' },
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        return { id: firebaseUser.uid, ...newUser } as User;
    } catch {
        // If Firestore fails (offline), return basic profile from Firebase Auth
        console.warn('Firestore unavailable during sign-in, using basic profile');
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Traveler',
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
            preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' }
        } as User;
    }
};

// Sign in with Yahoo
export const signInWithYahoo = async (): Promise<User> => {
    const { auth, db } = ensureInitialized();
    const provider = new OAuthProvider('yahoo.com');
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;

    try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
            return { id: firebaseUser.uid, ...userDoc.data() } as User;
        }

        const newUser: Omit<User, 'id'> = {
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || 'Anonymous',
            photoURL: firebaseUser.photoURL || undefined,
            bio: '',
            createdAt: serverTimestamp() as unknown as Timestamp,
            updatedAt: serverTimestamp() as unknown as Timestamp,
            stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
            preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' },
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        return { id: firebaseUser.uid, ...newUser } as User;
    } catch {
        console.warn('Firestore unavailable during sign-in, using basic profile');
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Traveler',
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
            preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' }
        } as User;
    }
};

// Sign in with Microsoft (Hotmail/Outlook)
export const signInWithMicrosoft = async (): Promise<User> => {
    const { auth, db } = ensureInitialized();
    const provider = new OAuthProvider('microsoft.com');
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;

    try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
            return { id: firebaseUser.uid, ...userDoc.data() } as User;
        }

        const newUser: Omit<User, 'id'> = {
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || 'Anonymous',
            photoURL: firebaseUser.photoURL || undefined,
            bio: '',
            createdAt: serverTimestamp() as unknown as Timestamp,
            updatedAt: serverTimestamp() as unknown as Timestamp,
            stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
            preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' },
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        return { id: firebaseUser.uid, ...newUser } as User;
    } catch {
        console.warn('Firestore unavailable during sign-in, using basic profile');
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Traveler',
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
            preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' }
        } as User;
    }
};

// Sign out
export const signOut = async (): Promise<void> => {
    if (!auth) return;
    try {
        await firebaseSignOut(auth);
    } catch (error: unknown) {
        throw new Error((error as Error).message || 'Failed to sign out');
    }
};

// Reset password
export const resetPassword = async (email: string): Promise<void> => {
    const { auth } = ensureInitialized();
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
        throw new Error((error as Error).message || 'Failed to send password reset email');
    }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
    if (!auth || !db) return null;

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
        return null;
    }

    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    if (!userDoc.exists()) {
        return null;
    }

    return { id: firebaseUser.uid, ...userDoc.data() } as User;
};

// Auth state observer
export const onAuthChange = (callback: (user: User | null) => void) => {
    if (!auth || !db) {
        callback(null);
        return () => { }; // No-op unsubscribe
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            try {
                const userDoc = await getDoc(doc(db!, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    callback({ id: firebaseUser.uid, ...(userDoc.data() as Omit<User, 'id'>) } as User);
                } else {
                    // Fallback for new users or missing docs
                    callback({
                        id: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        displayName: firebaseUser.displayName || 'Traveler',
                        photoURL: firebaseUser.photoURL || undefined,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
                        preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' }
                    } as User);
                }
            } catch {
                console.warn('Firebase: Auth profile fetch failed (probably offline). Using basic profile.');
                callback({
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    displayName: firebaseUser.displayName || 'Traveler',
                    photoURL: firebaseUser.photoURL || undefined,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    stats: { postsCount: 0, followersCount: 0, followingCount: 0, tripsCount: 0, countriesVisited: 0 },
                    preferences: { theme: 'system', notifications: true, emailNotifications: true, privacy: 'public' }
                } as User);
            }
        } else {
            callback(null);
        }
    });
};
