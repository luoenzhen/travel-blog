'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTripStore } from '@/store/tripStore';
import TripCard from '@/components/trips/TripCard';
import CreateTripModal from '@/components/trips/CreateTripModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export default function TripsPage() {
    const router = useRouter();
    const { trips, fetchTrips, loading, removeTrip, toggleTripLock, importTrip } = useTripStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tripToDelete, setTripToDelete] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        fetchTrips();
    }, [fetchTrips]);

    if (!isClient) return null; // Avoid hydration mismatch for local storage

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-4 sm:py-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 dark:text-white">My Trips</h1>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Plan and manage adventures</p>
                    </div>
                    <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                        <input
                            type="file"
                            id="import-trip-file"
                            className="hidden"
                            accept=".json"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                try {
                                    const text = await file.text();
                                    const tripData = JSON.parse(text);

                                    // Basic validation
                                    if (!tripData.title || !tripData.startDate || !tripData.endDate) {
                                        throw new Error("Invalid trip file format");
                                    }

                                    await importTrip(tripData);
                                    e.target.value = ''; // Reset input
                                    alert('Trip imported successfully!');
                                } catch (error: any) {
                                    console.error('Import error:', error);
                                    alert('Failed to import trip: ' + error.message);
                                }
                            }}
                        />
                        <button
                            onClick={() => document.getElementById('import-trip-file')?.click()}
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 text-sm sm:text-base"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span className="inline sm:inline">Import</span>
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="inline sm:inline">New Trip</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                        ))}
                    </div>
                ) : trips.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
                        {trips.map((trip) => (
                            <TripCard
                                key={trip.id}
                                trip={trip}
                                onClick={() => router.push(`/trips/${trip.id}`)}
                                onDelete={(e) => {
                                    e.stopPropagation();
                                    setTripToDelete(trip.id);
                                }}
                                onToggleLock={() => toggleTripLock(trip.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-lg border border-gray-100 dark:border-gray-700 animate-fade-in">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors cursor-pointer"
                        >
                            <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No trips yet</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                            Start planning your next adventure by creating a detailed itinerary with flights, hotels, and activities.
                        </p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                        >
                            Create Your First Trip
                        </button>
                    </div>
                )}

                <CreateTripModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />

                <ConfirmationModal
                    isOpen={!!tripToDelete}
                    onClose={() => setTripToDelete(null)}
                    onConfirm={async () => {
                        if (tripToDelete) {
                            await removeTrip(tripToDelete);
                        }
                    }}
                    title="Delete Trip"
                    message="Are you sure you want to delete this trip? This action cannot be undone and all associated data will be lost."
                    confirmText="Delete Trip"
                    isDangerous={true}
                />
            </div>
        </div>
    );
}
