'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTripStore } from '@/store/tripStore';
import { Timestamp } from 'firebase/firestore';
import { Trip } from '@/types';
import { generateMagicItinerary } from '@/lib/ai';

import { CURRENCIES } from '@/lib/constants';

const tripSchema = z.object({
    title: z.string().min(3, 'Title is too short'),
    destination: z.string().min(2, 'Destination is required'),
    currency: z.string().min(3, 'Currency is required'),
    startDate: z.string().refine((date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }, {
        message: 'Valid start date is required',
    }),
    endDate: z.string().refine((date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }, {
        message: 'Valid end date is required',
    }),
}).refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start && end && start <= end;
}, {
    message: 'End date must be after start date',
    path: ['endDate'],
});

type TripForm = z.infer<typeof tripSchema>;

interface CreateTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    tripToEdit?: Trip;
}

export default function CreateTripModal({ isOpen, onClose, tripToEdit }: CreateTripModalProps) {
    const { addTrip, updateTripDetails } = useTripStore();
    const [loading, setLoading] = useState(false);
    const [isAiMode, setIsAiMode] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const formatDate = (dateStr: string) => {
        // Convert YYYY-MM-DD to dd-Mon-yyyy
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const startDateRef = useRef<HTMLInputElement>(null);
    const endDateRef = useRef<HTMLInputElement>(null);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<TripForm>({
        resolver: zodResolver(tripSchema),
        defaultValues: {
            title: '',
            destination: '',
            currency: 'CNY',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
        },
    });

    const onSubmit = async (data: TripForm) => {
        setLoading(true);
        try {
            if (tripToEdit) {
                await updateTripDetails(tripToEdit.id, {
                    title: data.title,
                    destination: data.destination,
                    startDate: Timestamp.fromDate(new Date(data.startDate)),
                    endDate: Timestamp.fromDate(new Date(data.endDate)),
                    budget: {
                        ...tripToEdit.budget,
                        currency: data.currency
                    }
                });
            } else if (isAiMode) {
                if (!aiPrompt.trim()) {
                    alert("Please describe your trip first!");
                    setLoading(false);
                    return;
                }
                const generatedTrip = await generateMagicItinerary(aiPrompt, data.startDate, data.endDate, data.title, data.destination);

                await addTrip({
                    ...generatedTrip,
                    title: data.title || generatedTrip.title,
                    destination: data.destination || generatedTrip.destination,
                    startDate: Timestamp.fromDate(new Date(data.startDate)),
                    endDate: Timestamp.fromDate(new Date(data.endDate)),
                    budget: {
                        totalBudget: 0,
                        currency: data.currency,
                        categories: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 },
                        actualSpending: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 }
                    }
                } as Partial<Trip>);
            } else {
                await addTrip({
                    title: data.title,
                    destination: data.destination,
                    startDate: Timestamp.fromDate(new Date(data.startDate)),
                    endDate: Timestamp.fromDate(new Date(data.endDate)),
                    budget: {
                        totalBudget: 0,
                        currency: data.currency,
                        categories: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 },
                        actualSpending: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 }
                    }
                });
            }
            reset();
            onClose();
        } catch (error: unknown) {
            console.error('Failed to save trip', error);
            const errorMessage = error instanceof Error ? error.message : "Failed to generate itinerary. Check your API key.";
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (tripToEdit) {
                const start = (tripToEdit.startDate as Timestamp | { toDate?: () => Date }).toDate ? (tripToEdit.startDate as Timestamp).toDate() : new Date(tripToEdit.startDate as unknown as string);
                const end = (tripToEdit.endDate as Timestamp | { toDate?: () => Date }).toDate ? (tripToEdit.endDate as Timestamp).toDate() : new Date(tripToEdit.endDate as unknown as string);

                const startStr = start.toISOString().split('T')[0];
                const endStr = end.toISOString().split('T')[0];

                setStartDate(startStr);
                setEndDate(endStr);

                reset({
                    title: tripToEdit.title,
                    destination: tripToEdit.destination,
                    currency: tripToEdit.budget?.currency || 'CNY',
                    startDate: startStr,
                    endDate: endStr,
                });
            } else {
                const today = new Date().toISOString().split('T')[0];
                setStartDate(today);
                setEndDate(today);
                reset({
                    title: '',
                    destination: '',
                    currency: 'CNY',
                    startDate: today,
                    endDate: today,
                });
            }
        }
    }, [isOpen, reset, tripToEdit]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-slide-up overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-primary-500/5 to-transparent">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                            {tripToEdit ? 'Edit Trip' : (isAiMode ? '🤖 Magic Generator' : 'Plan New Trip')}
                        </h2>
                        {!tripToEdit && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isAiMode ? 'AI will build your full itinerary' : 'Manually plan your journey'}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {!tripToEdit && (
                            <button
                                onClick={() => setIsAiMode(!isAiMode)}
                                className={`p-2 rounded-xl transition-all duration-300 ${isAiMode
                                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 active:scale-95'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                                    }`}
                                title={isAiMode ? "Back to Manual Mode" : "Use AI Magic"}
                            >
                                <svg className={`w-5 h-5 ${isAiMode ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Trip Title
                            </label>
                            <input
                                {...register('title')}
                                placeholder="e.g. Summer in Tokyo"
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Destination
                                </label>
                                <input
                                    {...register('destination')}
                                    placeholder="e.g. Tokyo, Japan"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                                {errors.destination && <p className="text-red-500 text-sm mt-1">{errors.destination.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Currency
                                </label>
                                <select
                                    {...register('currency')}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                                >
                                    {CURRENCIES.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.code} ({c.symbol})
                                        </option>
                                    ))}
                                </select>
                                {errors.currency && <p className="text-red-500 text-sm mt-1">{errors.currency.message}</p>}
                            </div>
                        </div>
                    </div>

                    {isAiMode && !tripToEdit && (
                        <div className="p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800/50 animate-fade-in shadow-inner">
                            <label className="block text-sm font-bold text-primary-900 dark:text-primary-200 mb-2">
                                AI Magic Prompt 🪄
                            </label>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="e.g. I love ramen and hidden bars, but I hate crowds. Focus on local experiences..."
                                className="w-full h-32 px-4 py-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none text-sm leading-relaxed"
                            />
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-primary-600 dark:text-primary-400">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                AI will generate activities and smart images specialized for your trip destination.
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Start Date
                            </label>
                            <div className="relative cursor-pointer group" onClick={() => {
                                try {
                                    if (startDateRef.current) {
                                        startDateRef.current.showPicker();
                                    }
                                } catch {
                                    // Fallback for older browsers
                                    startDateRef.current?.click();
                                }
                            }}>
                                <div className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between group-hover:border-primary-500 transition-colors pointer-events-none">
                                    <span className="text-gray-900 dark:text-gray-100">{formatDate(startDate) || 'dd-Mon-yyyy'}</span>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input
                                    ref={startDateRef}
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setValue('startDate', e.target.value);
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                                    tabIndex={-1}
                                />
                            </div>
                            {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                End Date
                            </label>
                            <div className="relative cursor-pointer group" onClick={() => {
                                try {
                                    if (endDateRef.current) {
                                        endDateRef.current.showPicker();
                                    }
                                } catch {
                                    endDateRef.current?.click();
                                }
                            }}>
                                <div className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between group-hover:border-primary-500 transition-colors pointer-events-none">
                                    <span className="text-gray-900 dark:text-gray-100">{formatDate(endDate) || 'dd-Mon-yyyy'}</span>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input
                                    ref={endDateRef}
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setValue('endDate', e.target.value);
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                                    tabIndex={-1}
                                />
                            </div>
                            {errors.endDate && <p className="text-red-500 text-sm mt-1">{errors.endDate.message}</p>}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 px-4 py-2 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${loading
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : (isAiMode ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/20' : 'bg-primary-600 text-white hover:bg-primary-700')
                                }`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {isAiMode ? 'Generating...' : 'Saving...'}
                                </>
                            ) : (
                                <>
                                    {isAiMode && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    )}
                                    {tripToEdit ? 'Save Changes' : (isAiMode ? 'Magic Generate' : 'Create Trip')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
