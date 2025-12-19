import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config';

/**
 * Uploads a trip photo to Firebase Storage
 * @param tripId The ID of the trip
 * @param dayId The ID of the day
 * @param file The file (Blob/File) to upload
 * @returns The download URL of the uploaded image
 */
export const uploadTripPhoto = async (tripId: string, dayId: string, file: Blob | File): Promise<string> => {
    console.log(`[STORAGE] Starting uploadTripPhoto: tripId=${tripId}, dayId=${dayId}, size=${file.size}, type=${file.type}`);

    if (!storage) {
        console.error('[STORAGE] Storage not initialized');
        throw new Error('Firebase Storage not initialized');
    }

    try {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storagePath = `trips/${tripId}/days/${dayId}/${fileName}`;
        console.log(`[STORAGE] Generated path: ${storagePath}`);

        const storageRef = ref(storage, storagePath);

        console.log('[STORAGE] Converting Blob to Uint8Array...');
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log(`[STORAGE] Conversion complete: ${uint8Array.length} bytes`);

        console.log('[STORAGE] Starting uploadBytes...');
        const snapshot = await uploadBytes(storageRef, uint8Array);
        console.log('[STORAGE] uploadBytes completed successfully');

        console.log('[STORAGE] Getting download URL...');
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log(`[STORAGE] Download URL obtained: ${downloadURL}`);

        return downloadURL;
    } catch (error) {
        console.error('[STORAGE] Upload failed:', error);
        throw error;
    }
};
