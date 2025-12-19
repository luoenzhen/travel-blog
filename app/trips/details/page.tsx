'use client';

import { Suspense } from 'react';
import TripContent from '@/components/trips/TripDetails';

export default function TripDetailsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        }>
            <TripContent />
        </Suspense>
    );
}
