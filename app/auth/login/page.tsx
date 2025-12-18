'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmail, signInWithGoogle, resetPassword } from '@/lib/firebase/auth';
import { useAuthStore } from '@/store/authStore';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const { setUser, setError } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [resetSent, setResetSent] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const emailValue = watch('email');

    const onSubmit = async (data: LoginForm) => {
        setLoading(true);
        setAuthError(null);
        try {
            const user = await signInWithEmail(data.email, data.password);
            setUser(user);
            router.push('/'); // Redirect to home after login
        } catch (error: any) {
            setAuthError('Invalid email or password');
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setAuthError(null);
        try {
            const user = await signInWithGoogle();
            setUser(user);
            router.push('/'); // Redirect to home after social login
        } catch (error: any) {
            setAuthError(error.message);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!emailValue) {
            setAuthError('Please enter your email address first');
            return;
        }

        try {
            await resetPassword(emailValue);
            setResetSent(true);
            setAuthError(null);
        } catch (error: any) {
            setAuthError(error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Log in to continue your journey</p>
            </div>

            {authError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {authError}
                </div>
            )}

            {resetSent && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm">
                    Password reset email sent! Check your inbox.
                </div>
            )}

            <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                    />
                </svg>
                <span className="text-gray-700 dark:text-gray-300 font-medium">Continue with Google</span>
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Or log in with email</span>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address
                    </label>
                    <input
                        {...register('email')}
                        type="email"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                        placeholder="you@example.com"
                    />
                    {errors.email && (
                        <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Password
                    </label>
                    <input
                        {...register('password')}
                        type="password"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                        placeholder="••••••••"
                    />
                    {errors.password && (
                        <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                    )}
                </div>

                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm font-medium text-primary-500 hover:text-primary-600 hover:underline"
                    >
                        Forgot password?
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    {loading ? 'Logging in...' : 'Log In'}
                </button>
            </form>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="text-primary-500 hover:text-primary-600 font-semibold hover:underline">
                    Sign up
                </Link>
            </div>
        </div>
    );
}
