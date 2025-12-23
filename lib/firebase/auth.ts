import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    sendPasswordResetEmail,
    updateProfile,
    OAuthProvider,
    UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Browser } from '@capacitor/browser';
import { auth, db } from './config';
import { User } from '@/types';

// Helper to detect if we're running in Capacitor/iOS
const isCapacitor = () => {
    if (typeof window === 'undefined') return false;
    
    // Check for Capacitor object
    const windowWithCapacitor = window as Window & { Capacitor?: unknown };
    if (windowWithCapacitor.Capacitor) {
        console.log('Capacitor detected via window.Capacitor');
        return true;
    }
    
    // Check user agent for iOS devices or simulator
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    
    // Check for iOS devices (but not simulator - simulators can use popup)
    const isIOSDevice = /iPhone|iPad|iPod/i.test(ua) && !/Mac OS X/i.test(ua);
    // Check for iPad on iOS 13+ (shows as MacIntel but has touch)
    const isIPadOS = platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/Mac OS X/i.test(ua);
    // Check for Capacitor in user agent
    const isCapacitorUA = ua.includes('Capacitor');
    
    // For iOS Simulator, detect it but don't use redirect (neither popup nor redirect work well in simulators)
    const isIOSSimulator = /iPhone|iPad|iPod/i.test(ua) && /Mac OS X/i.test(ua);
    
    const result = (isIOSDevice || isIPadOS || isCapacitorUA) && !isIOSSimulator;
    
    console.log('isCapacitor check:', {
        isIOSDevice,
        isIPadOS,
        isCapacitorUA,
        isIOSSimulator,
        ua,
        platform,
        result,
        note: isIOSSimulator ? 'iOS Simulator detected - will use popup instead of redirect' : ''
    });
    
    return result;
};

// Helper to process user credential and return User
const processUserCredential = async (userCredential: UserCredential): Promise<User> => {
    const firebaseUser = userCredential.user;
    const { db } = ensureInitialized();

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

// Helper to detect iOS Simulator - only used for error messages, not blocking
const isLikelyIOSSimulator = (error: unknown): boolean => {
    if (typeof window === 'undefined') return false;
    const errorMessage = String((error as { message?: string })?.message || '');
    const errorString = String(error || '');
    
    // Check for simulator-specific error patterns
    if (errorMessage.includes('invalid input parameters') || 
        errorMessage.includes('Failed to open URL') ||
        errorString.includes('NSOSStatusErrorDomain') ||
        errorString.includes('invalid input parameters')) {
        // Also check user agent as secondary confirmation
        const ua = navigator.userAgent || '';
        return /iPhone|iPad|iPod/i.test(ua) && /Mac OS X/i.test(ua);
    }
    return false;
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
    const { auth } = ensureInitialized();
    
    const provider = new GoogleAuthProvider();
    
    // Add custom parameters to force account selection
    provider.setCustomParameters({
        prompt: 'select_account',
        hd: ''
    });
    
    const useRedirect = isCapacitor();
    console.log('Sign in with Google - useRedirect:', useRedirect, 'UserAgent:', navigator.userAgent);
    console.log('Auth domain:', auth.config.authDomain);
    console.log('Current URL:', window.location.href);
    
    // For Capacitor/iOS, use Browser plugin to open OAuth in Safari
    // signInWithRedirect doesn't work properly in Capacitor WebView
    if (useRedirect) {
        console.log('Using Browser plugin for Capacitor/iOS OAuth flow');
        
        // Check if we're in simulator - more accurate detection
        // Real iOS devices have "Mobile" in user agent, simulators don't
        // Also check platform - simulators show "MacIntel" as platform
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        const isSimulator = (
            (/iPhone|iPad|iPod/i.test(ua) && platform === 'MacIntel') ||
            ua.includes('Simulator') ||
            (!ua.includes('Mobile') && /iPhone|iPad|iPod/i.test(ua) && platform.includes('Mac'))
        );
        
        if (isSimulator) {
            console.log('iOS Simulator detected - blocking OAuth');
            throw new Error('OAuth sign-in is not available in iOS Simulator. Please use email/password authentication or test on a real device.');
        }
        
        console.log('Real iOS device detected - proceeding with OAuth');
        
        try {
            // signInWithRedirect hangs in Capacitor WebView, so we'll use a timeout
            // and then manually navigate to the OAuth URL
            console.log('Attempting signInWithRedirect with timeout...');
            
            // Start the redirect but don't wait for it
            const redirectPromise = signInWithRedirect(auth, provider);
            
            // Add a timeout - if redirect doesn't happen quickly, it's stuck
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Redirect timeout - WebView may not support redirects'));
                }, 2000); // 2 second timeout
            });
            
            try {
                await Promise.race([redirectPromise, timeoutPromise]);
                // If we get here, redirect happened
                console.log('Redirect initiated by Firebase');
                return new Promise(() => {});
            } catch {
                // Redirect is stuck - need to manually open OAuth URL
                console.log('signInWithRedirect is stuck, using manual OAuth URL construction');
                
                // Construct the OAuth URL manually using Firebase's expected format
                // We'll use the Firebase auth domain and construct a proper redirect URL
                const authDomain = auth.config.authDomain;
                const apiKey = auth.config.apiKey;
                
                // Use Firebase's auth domain as the redirect URL (Firebase will handle it)
                const redirectUrl = encodeURIComponent(`https://${authDomain}/auth/login`);
                
                // Use Firebase's auth handler to construct the proper OAuth URL
                const authUrl = `https://${authDomain}/__/auth/handler?apiKey=${apiKey}&authType=signInWithRedirect&providerId=google.com&redirectUrl=${redirectUrl}`;
                
                console.log('Opening OAuth URL in Safari via Browser plugin:', authUrl);
                
                // Open in Safari using Browser plugin
                await Browser.open({ url: authUrl });
                
                console.log('Browser opened - complete sign-in in Safari');
                console.log('After sign-in, Safari will redirect back to the app');
                
                // Return promise that never resolves - redirect will happen
                return new Promise(() => {});
            }
        } catch (redirectError: unknown) {
            console.error('OAuth flow failed:', redirectError);
            
            const redirectAuthError = redirectError as { code?: string; message?: string };
            const errorMsg = redirectAuthError.message || 
                'Unable to sign in with Google. Please try using email/password authentication.';
            throw new Error(errorMsg);
        }
    }
    
    // For web browsers, try popup first with timeout
    try {
        console.log('Attempting popup flow for Google sign-in');
        
        // Add timeout to detect if popup hangs
        const popupPromise = signInWithPopup(auth, provider);
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Popup timeout - popup may be blocked or not supported'));
            }, 3000); // 3 second timeout
        });
        
        const userCredential = await Promise.race([popupPromise, timeoutPromise]);
        console.log('Popup flow successful');
        return processUserCredential(userCredential);
    } catch (popupError: unknown) {
        const popupAuthError = popupError as { code?: string; message?: string };
        console.error('Popup flow failed:', popupAuthError.code, popupAuthError.message, popupError);
        
        // Fallback to redirect if popup fails
        if (popupAuthError.code === 'auth/popup-blocked' || 
            popupAuthError.code === 'auth/popup-closed-by-user' ||
            popupAuthError.code === 'auth/cancelled-popup-request' ||
            popupAuthError.message?.includes('timeout')) {
            console.log('Falling back to redirect flow');
            try {
                await signInWithRedirect(auth, provider);
                console.log('Redirect initiated - page should navigate');
                return new Promise(() => {});
            } catch (redirectError: unknown) {
                console.error('Redirect also failed:', redirectError);
                
                // Check if this is a simulator-specific error
                if (isLikelyIOSSimulator(redirectError)) {
                    throw new Error('OAuth sign-in is not available in iOS Simulator. Please use email/password authentication or test on a real device.');
                }
                
                // If redirect also fails, throw the original popup error with helpful message
                const errorMsg = popupAuthError.message || 
                    'Unable to sign in. Popups may be blocked. Please allow popups for this site or try using email/password.';
                throw new Error(errorMsg);
            }
        }
        // For other errors, throw them
        throw popupError;
    }
};

// Sign in with Yahoo
export const signInWithYahoo = async (): Promise<User> => {
    const { auth } = ensureInitialized();
    
    const provider = new OAuthProvider('yahoo.com');
    
    const useRedirect = isCapacitor();
    
    // Try popup first for all platforms
    try {
        const userCredential = await signInWithPopup(auth, provider);
        return processUserCredential(userCredential);
    } catch (popupError: unknown) {
        const popupAuthError = popupError as { code?: string; message?: string };
        
        // Fallback to redirect if popup fails or in Capacitor
        if (useRedirect || 
            popupAuthError.code === 'auth/popup-blocked' || 
            popupAuthError.code === 'auth/popup-closed-by-user') {
            try {
                await signInWithRedirect(auth, provider);
                return new Promise(() => {});
            } catch (redirectError: unknown) {
                if (isLikelyIOSSimulator(redirectError)) {
                    throw new Error('OAuth sign-in is not available in iOS Simulator. Please use email/password authentication or test on a real device.');
                }
                throw redirectError;
            }
        }
        throw popupError;
    }
};

// Sign in with Microsoft (Hotmail/Outlook)
export const signInWithMicrosoft = async (): Promise<User> => {
    const { auth } = ensureInitialized();
    
    const provider = new OAuthProvider('microsoft.com');
    
    // Add prompt parameter to force account selection
    provider.setCustomParameters({
        prompt: 'select_account'
    });
    
    const useRedirect = isCapacitor();
    
    // Try popup first for all platforms
    try {
        const userCredential = await signInWithPopup(auth, provider);
        return processUserCredential(userCredential);
    } catch (popupError: unknown) {
        const popupAuthError = popupError as { code?: string; message?: string };
        
        // Fallback to redirect if popup fails or in Capacitor
        if (useRedirect || 
            popupAuthError.code === 'auth/popup-blocked' || 
            popupAuthError.code === 'auth/popup-closed-by-user') {
            try {
                await signInWithRedirect(auth, provider);
                return new Promise(() => {});
            } catch (redirectError: unknown) {
                if (isLikelyIOSSimulator(redirectError)) {
                    throw new Error('OAuth sign-in is not available in iOS Simulator. Please use email/password authentication or test on a real device.');
                }
                throw redirectError;
            }
        }
        throw popupError;
    }
};

// Handle redirect result (call this on app load to check for redirect results)
export const handleAuthRedirect = async (): Promise<User | null> => {
    const { auth } = ensureInitialized();
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            return processUserCredential(result);
        }
        return null;
    } catch (error) {
        // If it's a popup-blocked error or similar, that's okay - just return null
        const errorMessage = (error as Error).message || '';
        if (errorMessage.includes('popup') || errorMessage.includes('redirect')) {
            return null;
        }
        console.error('Error handling auth redirect:', error);
        throw new Error(errorMessage || 'Failed to handle authentication redirect');
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
