import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, enableNetwork, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = (getApps().length === 0 && firebaseConfig.apiKey) ? initializeApp(firebaseConfig) : getApps()[0];

const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

let db: Firestore | null = null;
if (app) {
    if (typeof window !== 'undefined') {
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                }),
                experimentalForceLongPolling: true
            });

            // Enable network to ensure Firestore can work offline and sync when online
            enableNetwork(db).catch((err) => {
                console.warn('Firebase: Could not enable network, but offline mode will still work:', err.message);
            });

            console.log('Firebase: Connected with persistence and long polling enabled.');
        } catch (e: unknown) {
            const error = e as { code?: string };
            if (error.code === 'failed-precondition') {
                console.warn('Firebase: Persistence failed (multiple tabs open). Falling back to memory cache.');
                db = getFirestore(app);
            } else if (error.code === 'already-exists') {
                console.log('Firebase: Already initialized, using existing instance.');
                db = getFirestore(app);
            } else {
                console.error('Firebase: Initialization error:', e);
                db = getFirestore(app);
            }
        }
    } else {
        db = getFirestore(app);
    }
}

if (typeof window !== 'undefined') {
    if (!firebaseConfig.apiKey) {
        console.error('Firebase: API Key is missing! Check your .env.local file.');
    }
    if (!app) {
        console.warn('Firebase: App failed to initialize. Guest mode active.');
    }
} else {
    // Server-side logging
    console.log('Firebase: Initializing on server for Project:', firebaseConfig.projectId || 'UNKNOWN');
    if (!firebaseConfig.apiKey) {
        console.warn('Firebase: API Key is missing on server environment.');
    }
}

export { app, auth, db, storage };
