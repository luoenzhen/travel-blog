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
            </div>
        </div>
    );
}
