import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    User as FirebaseUser,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
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
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sign up');
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
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sign in');
    }
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
    const { auth, db } = ensureInitialized();
    try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;

        // Check if user already exists
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
            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
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
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sign in with Google');
    }
};

// Sign out
export const signOut = async (): Promise<void> => {
    if (!auth) return;
    try {
        await firebaseSignOut(auth);
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sign out');
    }
};

// Reset password
export const resetPassword = async (email: string): Promise<void> => {
    const { auth } = ensureInitialized();
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
        throw new Error(error.message || 'Failed to send password reset email');
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
            const userDoc = await getDoc(doc(db!, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                callback({ id: firebaseUser.uid, ...(userDoc.data() as any) } as User);
            } else {
                callback(null);
            }
        } else {
            callback(null);
        }
    });
};
