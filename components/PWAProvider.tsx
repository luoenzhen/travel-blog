'use client';

import { useEffect } from 'react';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            defineCustomElements(window);
        }
    }, []);

    return <>{children}</>;
}
