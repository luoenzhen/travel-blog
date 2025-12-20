'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity } from '@/types';
import { CURRENCIES } from '@/lib/constants';

const activitySchema = z.object({
    type: z.enum(['sightseeing', 'dining', 'shopping', 'transport', 'entertainment', 'other']),
    name: z.string().min(2, 'Name is required'),
    location: z.string().min(2, 'Location is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    cost: z.number().min(0, 'Cost must be positive').optional(),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
});

type ActivityForm = z.infer<typeof activitySchema>;

interface AddActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Activity>) => Promise<void>;
    onDelete?: (activityId: string) => Promise<void>;
    dayDate: string;
    currencyCode?: string;
    editingActivity?: Activity;
}

export default function AddActivityModal({ isOpen, onClose, onSave, onDelete, dayDate, currencyCode = 'USD', editingActivity }: AddActivityModalProps) {
    const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || '$';
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<ActivityForm>({
        resolver: zodResolver(activitySchema),
        values: editingActivity ? {
            type: editingActivity.type || 'sightseeing',
            name: editingActivity.name,
            location: editingActivity.location.name,
            startTime: editingActivity.startTime,
            endTime: editingActivity.endTime,
            cost: editingActivity.cost,
            notes: editingActivity.notes || '',
            imageUrl: editingActivity.imageUrl || ''
        } : {
            type: 'sightseeing',
            name: '',
            location: '',
            cost: 0,
            startTime: '09:00',
            endTime: '11:00',
            notes: '',
            imageUrl: ''
        }
    });

    const activityName = watch('name');
    const activityLocation = watch('location');
    const selectedimageUrl = watch('imageUrl');
    const activityType = watch('type');

    const handleAutoFindImage = () => {
        if (!activityName) return;

        const variations = ['exterior view', 'professional photography', 'scenery', 'landmark', 'interior lobby', 'aerial view'];
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        const randomSalt = Math.floor(Math.random() * 1000);

        // Putting variation at the front often yields more diverse results from Bing
        const query = `${randomVariation} ${activityName} ${activityLocation} ${activityType}`;
        // Adding a timestamp/random salt as a separate param at the end to force browser re-render
        const autoUrl = `https://www.bing.com/th?q=${query}&w=1200&h=600&c=4&rs=1&qlt=90&cdv=1&pid=16.1&r=${randomSalt}`;

        setValue('imageUrl', autoUrl);
    };

    const onSubmit = async (data: ActivityForm) => {
        try {
            await onSave({
                type: data.type,
                name: data.name,
                location: { name: data.location, latitude: 0, longitude: 0 }, // Placeholder for now
                startTime: data.startTime,
                endTime: data.endTime,
                cost: data.cost || 0,
                currency: currencyCode,
                notes: data.notes,
                imageUrl: data.imageUrl || '',
                bookingRequired: false,
                photos: []
            });
            reset();
            onClose();
        } catch (error) {
            console.error('Failed to save activity', error);
        }
    };

    const selectedType = watch('type');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {editingActivity ? 'Edit Activity' : 'Add Activity'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">for {dayDate}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Activity Type
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {(['sightseeing', 'dining', 'shopping', 'transport', 'entertainment', 'other'] as const).map((t) => (
                                <label
                                    key={t}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all cursor-pointer ${selectedType === t
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                        : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 text-gray-500'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        value={t}
                                        {...register('type')}
                                        className="hidden"
                                    />
                                    <span className="text-[10px] font-bold capitalize">{t}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Activity Name
                        </label>
                        <div className="flex gap-2">
                            <input
                                {...register('name')}
                                placeholder="e.g. Visit Eiffel Tower"
                                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAutoFindImage}
                                disabled={!activityName}
                                className="px-3 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl border border-primary-100 dark:border-primary-800 hover:bg-primary-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Auto-find matching image"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-bold whitespace-nowrap">Smart Image</span>
                            </button>

                        </div>
                        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                    </div>

                    {selectedimageUrl && (
                        <div className="relative group rounded-xl overflow-hidden aspect-[21/9] border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                            <img src={selectedimageUrl} alt="Preview" className="w-full h-full object-cover object-center" />
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Location
                        </label>
                        <div className="relative">
                            <input
                                {...register('location')}
                                placeholder="e.g. Champ de Mars"
                                className="w-full px-4 py-2 pl-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Start Time
                            </label>
                            <input
                                {...register('startTime')}
                                type="time"
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            {errors.startTime && <p className="text-red-500 text-sm mt-1">{errors.startTime.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                End Time
                            </label>
                            <input
                                {...register('endTime')}
                                type="time"
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            {errors.endTime && <p className="text-red-500 text-sm mt-1">{errors.endTime.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Approx. Cost ({currencyCode})
                        </label>
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
                                                // Identify safe math operators only
                                                // We can use a simple tokenizer to support +, -, *, /
                                                // Or simple eval if we sanitise, but `new Function` is slightly safer than direct eval
                                                // Let's do a strict check: must only contain digits, ., +, -, *, /, (, )
                                                if (/^[0-9+\-*/().\s]+$/.test(value)) {
                                                    // eslint-disable-next-line
                                                    return Number(new Function(`return ${value}`)());
                                                }
                                            } catch {
                                                return NaN; // Let validation handle it
                                            }
                                        }
                                        return value;
                                    }
                                })}
                                type="text"
                                className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        {errors.cost && <p className="text-red-500 text-sm mt-1">{errors.cost.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes
                        </label>
                        <textarea
                            {...register('notes')}
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                            placeholder="Booking ref, helpful tips..."
                        />
                    </div>
                </form>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-white dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    {editingActivity && onDelete && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirm('Are you sure you want to delete this activity?')) {
                                    await onDelete(editingActivity.id);
                                    onClose();
                                }
                            }}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : editingActivity ? 'Update Activity' : 'Add Activity'}
                    </button>
                </div>
            </div >
        </div >
    );
}
