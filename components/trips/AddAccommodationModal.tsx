'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AccommodationDetails } from '@/types';
import { CURRENCIES } from '@/lib/constants';

const accommodationSchema = z.object({
    name: z.string().min(2, 'Name is required'),
    type: z.enum(['hotel', 'airbnb', 'hostel', 'resort', 'other']),
    address: z.string().min(5, 'Address is required'),
    checkInDate: z.string().min(1, 'Date is required'),
    checkInTime: z.string().min(1, 'Check-in time required'),
    checkOutDate: z.string().min(1, 'Date is required'),
    checkOutTime: z.string().min(1, 'Check-out time required'),
    cost: z.number().min(0).optional(),
    bookingConfirmation: z.string().optional(),
    notes: z.string().optional(),
    color: z.string().optional(),
    imageUrl: z.string().optional(),
}).refine((data) => {
    const start = new Date(`${data.checkInDate}T${data.checkInTime}`);
    const end = new Date(`${data.checkOutDate}T${data.checkOutTime}`);
    return end > start;
}, {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"]
});

type AccommodationForm = z.infer<typeof accommodationSchema>;

interface AddAccommodationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<AccommodationDetails>) => Promise<void>;
    dayDate: string;
    dayDateIso?: string; // YYYY-MM-DD
    currencyCode?: string;
    initialData?: AccommodationDetails;
    onDelete?: (id: string) => Promise<void>;
}

export default function AddAccommodationModal({ isOpen, onClose, onSave, onDelete, dayDate, dayDateIso, currencyCode = 'USD', initialData }: AddAccommodationModalProps) {
    const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || '$';
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<AccommodationForm>({
        resolver: zodResolver(accommodationSchema),
        defaultValues: {
            type: 'hotel',
            checkInTime: '15:00',
            checkOutTime: '11:00',
            checkInDate: '',
            checkOutDate: '',
            cost: 0,
            color: '#ffffff',
            imageUrl: ''
        }
    });

    const propertyName = watch('name');
    const propertyAddress = watch('address');
    const selectedImageUrl = watch('imageUrl');
    const accommodationType = watch('type');

    const handleAutoFindImage = () => {
        if (!propertyName) return;

        // List of variations to get different types of images on each click
        const variations = ['exterior hotel', 'lobby interior', 'scenic view', 'aerial hotel', 'hotel building', 'modern architecture'];
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        const randomSalt = Math.floor(Math.random() * 1000);

        // Putting the variation at the front and adding a salt to the URL string itself
        const query = `${randomVariation} ${propertyName} ${propertyAddress} ${accommodationType}`;
        const autoUrl = `https://www.bing.com/th?q=${query}&w=1200&h=600&c=4&rs=1&qlt=90&cdv=1&pid=16.1&r=${randomSalt}`;

        setValue('imageUrl', autoUrl);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Editing existing stay
                reset({
                    type: initialData.type,
                    checkInDate: initialData.checkInDate,
                    checkInTime: initialData.checkInTime,
                    checkOutDate: initialData.checkOutDate,
                    checkOutTime: initialData.checkOutTime,
                    cost: initialData.cost,
                    name: initialData.name,
                    address: initialData.address,
                    notes: initialData.notes || '',
                    bookingConfirmation: initialData.bookingConfirmation || '',
                    color: initialData.color || '#ffffff',
                    imageUrl: initialData.imageUrl || ''
                });
            } else if (dayDateIso) {
                // Creating new stay
                const nextDay = new Date(dayDateIso);
                nextDay.setDate(nextDay.getDate() + 1);

                reset({
                    type: 'hotel',
                    checkInDate: dayDateIso,
                    checkInTime: '15:00',
                    checkOutDate: nextDay.toISOString().split('T')[0], // Default next day
                    checkOutTime: '11:00',
                    cost: 0,
                    name: '',
                    address: '',
                    notes: '',
                    bookingConfirmation: '', // Ensure clean state
                    color: '#ffffff',
                    imageUrl: ''
                });
            }
        }
    }, [isOpen, dayDateIso, reset, initialData]);

    const onSubmit = async (data: AccommodationForm) => {
        try {
            await onSave({
                name: data.name,
                type: data.type,
                address: data.address,
                location: { name: data.address, latitude: 0, longitude: 0 },
                checkInDate: data.checkInDate,
                checkInTime: data.checkInTime,
                checkOutDate: data.checkOutDate,
                checkOutTime: data.checkOutTime,
                cost: data.cost || 0,
                currency: currencyCode,
                costPerNight: data.cost || 0, // Placeholder
                bookingConfirmation: data.bookingConfirmation || '',
                amenities: [],
                notes: data.notes,
                color: data.color || '#ffffff',
                imageUrl: data.imageUrl || ''
            });
            reset();
            onClose();
        } catch (error) {
            console.error('Failed to save accommodation', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {initialData ? 'Edit Stay' : 'Add Stay'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dayDate === "Trip Duration" ? "Manage stay for the trip" : `for ${dayDate}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">

                    {/* Color Picker - moved to top for visibility */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Card Color</label>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { color: '#ffffff', label: 'White' },
                                { color: '#f0f9ff', label: 'Sky' }, // Light Blue
                                { color: '#f0fdf4', label: 'Mint' }, // Light Green
                                { color: '#fefce8', label: 'Cream' }, // Light Yellow
                                { color: '#fff1f2', label: 'Rose' }, // Light Red
                                { color: '#faf5ff', label: 'Lavender' }, // Light Purple
                                { color: '#fff7ed', label: 'Peach' }, // Light Orange
                                { color: '#f8fafc', label: 'Slate' }, // Light Gray
                            ].map((c) => (
                                <label key={c.color} className="relative cursor-pointer group">
                                    <input
                                        type="radio"
                                        value={c.color}
                                        {...register('color')}
                                        className="sr-only peer"
                                    />
                                    <div
                                        className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600 peer-checked:border-primary-500 peer-checked:scale-110 transition-all flex items-center justify-center shadow-sm"
                                        style={{ backgroundColor: c.color }}
                                        title={c.label}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full bg-primary-600 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                    </div>
                                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white dark:bg-gray-800 px-1 rounded shadow-sm border border-gray-100 dark:border-gray-700 z-10 pointer-events-none">
                                        {c.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property Name</label>
                        <div className="flex gap-2">
                            <input {...register('name')} placeholder="e.g. Grand Hotel" className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            <button
                                type="button"
                                onClick={handleAutoFindImage}
                                disabled={!propertyName}
                                className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Auto-find matching image"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-bold">Smart Image</span>
                            </button>

                        </div>
                        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                    </div>

                    {selectedImageUrl && (
                        <div className="relative group rounded-xl overflow-hidden aspect-[21/9] border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                            <img src={selectedImageUrl} alt="Preview" className="w-full h-full object-cover object-center" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => setValue('imageUrl', '')}
                                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="hidden">
                        <input {...register('imageUrl')} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                            <select {...register('type')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none">
                                <option value="hotel">Hotel</option>
                                <option value="airbnb">Airbnb</option>
                                <option value="hostel">Hostel</option>
                                <option value="resort">Resort</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost (Total) - {currencyCode}</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">{currencySymbol}</span>
                                </div>
                                <input
                                    {...register('cost', {
                                        valueAsNumber: true,
                                        setValueAs: (value) => {
                                            if (typeof value === 'string' && value.trim() !== '') {
                                                try {
                                                    if (/^[0-9+\-*/().\s]+$/.test(value)) {
                                                        // eslint-disable-next-line
                                                        return Number(new Function(`return ${value}`)());
                                                    }
                                                } catch {
                                                    return NaN;
                                                }
                                            }
                                            return value;
                                        }
                                    })}
                                    type="text"
                                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                        <input {...register('address')} placeholder="123 Main St, City" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                        {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>}
                    </div>

                    <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in Date</label>
                                <input type="date" {...register('checkInDate')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                {errors.checkInDate && <p className="text-red-500 text-sm mt-1">{errors.checkInDate.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                                <input type="time" {...register('checkInTime')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out Date</label>
                                <input type="date" {...register('checkOutDate')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                {errors.checkOutDate && <p className="text-red-500 text-sm mt-1">{errors.checkOutDate.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                                <input type="time" {...register('checkOutTime')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes / Confirmation</label>
                        <textarea {...register('notes')} rows={2} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none resize-none" placeholder="Details..." />
                    </div>

                </form>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-800/50">
                    {initialData && onDelete && (
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm('Are you sure you want to delete this stay?')) {
                                    onDelete(initialData.id).then(onClose);
                                }
                            }}
                            className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mr-auto"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-white dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="px-8 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {initialData ? 'Save Changes' : 'Add Stay'}
                    </button>
                </div>
            </div >
        </div >
    );
}
