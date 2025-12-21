"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TravelBlogLogo } from "@/components/ui/TravelBlogLogo";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push("/trips");
        }, 3000); // 3 seconds splash for a premium feel

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden relative">
            {/* Background Decorative Blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-200/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-accent-200/20 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="text-center max-w-4xl mx-auto space-y-8 animate-fade-in relative z-10 px-4">
                <div className="inline-block relative">
                    <div className="flex items-center justify-center w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-[2rem] shadow-2xl shadow-primary-500/20 transform animate-scale-in">
                        <TravelBlogLogo className="w-14 h-14 text-white" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-6xl md:text-8xl font-display font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent animate-slide-up pb-2 leading-tight">
                        TravelBlog
                    </h1>

                    <p className="text-xl md:text-3xl text-gray-600 dark:text-gray-300 font-light animate-slide-up [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards]">
                        Your journey, beautifully documented.
                    </p>
                </div>

                {/* Loading indicator */}
                <div className="pt-12 flex justify-center items-center gap-3 animate-fade-in [animation-delay:800ms] opacity-0 [animation-fill-mode:forwards]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:0ms]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:150ms]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:300ms]"></div>
                </div>
            </div>
        </div>
    );
}

