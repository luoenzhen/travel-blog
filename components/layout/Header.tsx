'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { TravelBlogLogo } from '@/components/ui/TravelBlogLogo';
import { useEffect, useState } from 'react';
import { useTripStore } from '@/store/tripStore';

export default function Header() {
    const { user, signOut } = useAuthStore();
    const { syncGuestTrips, loading: tripsLoading } = useTripStore();
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Automatic sync when user is detected
    useEffect(() => {
        const checkAndSync = async () => {
            if (user && !isSyncing) {
                const guestTrips = localStorage.getItem('travel_blog_guest_trips');
                if (guestTrips && JSON.parse(guestTrips).length > 0) {
                    setIsSyncing(true);
                    await syncGuestTrips();
                    setIsSyncing(false);
                }
            }
        };
        checkAndSync();
    }, [user, syncGuestTrips, isSyncing]);

    // Hide header on splash screen and auth pages
    const isSplash = pathname === '/';
    const isAuth = pathname.startsWith('/auth');
    const isDetails = pathname.startsWith('/trips/details');
    if (isSplash || isAuth || isDetails) return null;

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${scrolled
                ? 'pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 shadow-md'
                : 'pt-[calc(env(safe-area-inset-top)+0.625rem)] pb-2.5 sm:pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pb-3'
                }`}
        >
            <div className="container mx-auto px-4 flex items-center justify-between">
                <Link href="/trips" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <TravelBlogLogo className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-display font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                        TravelBlog
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    {user ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {user.displayName || 'Traveler'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isSyncing || tripsLoading ? 'bg-amber-500 animate-spin' : 'bg-green-500'}`} />
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                                        {isSyncing || tripsLoading ? 'Syncing...' : 'Synced'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="w-10 h-10 rounded-full border-2 border-primary-500/20 p-0.5 hover:border-primary-500 transition-colors"
                                title="Sign Out"
                            >
                                {user.photoURL ? (
                                    <Image src={user.photoURL} alt="Profile" width={40} height={40} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                        {user.displayName?.[0] || 'U'}
                                    </div>
                                )}
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/auth/login"
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-primary-500 transition-all group"
                        >
                            <div className="hidden sm:flex flex-col items-end mr-1">
                                <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-primary-500 transition-colors">
                                    Sign In to Sync
                                </span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
                                    Guest Mode
                                </span>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
