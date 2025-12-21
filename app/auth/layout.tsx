import Link from 'next/link';
import { TravelBlogLogo } from '@/components/ui/TravelBlogLogo';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl shadow-lg">
                            <TravelBlogLogo className="w-9 h-9 text-white" />
                        </div>
                        <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                            TravelBlog
                        </h1>
                    </Link>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-slide-up border border-gray-100 dark:border-gray-700">
                    {children}
                </div>
            </div>
        </div>
    );
}
