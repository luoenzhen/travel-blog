import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-safe">
            <div className="container mx-auto px-4 py-16">
                {/* Hero Section */}
                <div className="text-center max-w-4xl mx-auto space-y-8 animate-fade-in">
                    <div className="inline-block">
                        <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary-500 to-accent-500 rounded-3xl shadow-2xl transform hover:scale-105 transition-transform">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-6xl md:text-7xl font-display font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                        TravelBlog
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-light">
                        Document your adventures, share your stories, and discover the world
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                        <Link href="/trips" className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200">
                            Get Started
                        </Link>
                        <Link href="#features" className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-gray-200 dark:border-gray-700">
                            Learn More
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div id="features" className="grid md:grid-cols-3 gap-8 mt-24 max-w-6xl mx-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow animate-slide-up">
                        <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Share Your Journey</h3>
                        <p className="text-gray-600 dark:text-gray-400">Create beautiful travel posts with photos, videos, and rich stories to inspire others.</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="w-14 h-14 bg-accent-100 dark:bg-accent-900 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Plan Your Trips</h3>
                        <p className="text-gray-600 dark:text-gray-400">Organize day-by-day itineraries with flights, hotels, activities, and budgets all in one place.</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Discover Destinations</h3>
                        <p className="text-gray-600 dark:text-gray-400">Explore trending locations, get inspired by fellow travelers, and find your next adventure.</p>
                    </div>
                </div>

                {/* Status */}
                <div className="mt-24 text-center">
                    <div className="inline-block bg-white dark:bg-gray-800 rounded-2xl px-8 py-6 shadow-xl">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Status</p>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-gray-900 dark:text-white font-semibold">Building Phase 1 - Core Features</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
