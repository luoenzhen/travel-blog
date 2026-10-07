'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TransportationDetails, TransportType } from '@/types';
import { Timestamp } from 'firebase/firestore';


const transportSchema = z.object({
    type: z.enum(['flight', 'train', 'bus', 'other']),
    airline: z.string().min(2, 'Name is required'),
    flightNumber: z.string().optional(),
    departureAirport: z.string().min(2, 'Location required'),
    departureAirportCode: z.string().max(10, 'Code too long').toUpperCase().optional(),
    departureDate: z.string().min(1, 'Date is required'),
    departureTime: z.string().min(1, 'Time is required'),
    arrivalAirport: z.string().min(2, 'Location required'),
    arrivalAirportCode: z.string().max(10, 'Code too long').toUpperCase().optional(),
    arrivalDate: z.string().min(1, 'Date is required'),
    arrivalTime: z.string().min(1, 'Time is required'),
    cost: z.number().min(0).optional(),
    bookingReference: z.string().optional(),

    // Return Logic
    tripType: z.enum(['oneway', 'return']),
    returnAirline: z.string().optional(),
    returnFlightNumber: z.string().optional(),
    returnDepartureDate: z.string().optional(),
    returnDepartureTime: z.string().optional(),
    returnArrivalDate: z.string().optional(),
    returnArrivalTime: z.string().optional(),
});

type TransportForm = z.infer<typeof transportSchema>;

interface AddTransportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<TransportationDetails>) => Promise<void>;
    dayDate?: string;
    dayDateIso?: string;
    currencyCode?: string;
    initialData?: TransportationDetails;
    onDelete?: (id: string) => Promise<void>;
}

export default function AddTransportModal({ isOpen, onClose, onSave, onDelete, dayDate, dayDateIso, currencyCode = 'USD', initialData }: AddTransportModalProps) {


    const [tripType, setTripType] = useState<'oneway' | 'return'>('oneway');
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<TransportForm>({
        resolver: zodResolver(transportSchema),
        defaultValues: {
            type: 'flight',
            cost: 0,
            tripType: 'oneway'
        }
    });

    const transportType = watch('type');
    const depCode = watch('departureAirportCode');
    const arrCode = watch('arrivalAirportCode');
    const formTripType = watch('tripType');
    const formDepDate = watch('departureDate');
    const formArrDate = watch('arrivalDate');

    useEffect(() => {
        if (formTripType) {
            setTripType(formTripType);
            if (formTripType === 'return') {
                if (!watch('returnDepartureDate')) {
                    setValue('returnDepartureDate', formArrDate || formDepDate || new Date().toISOString().split('T')[0]);
                }
                if (!watch('returnArrivalDate')) {
                    setValue('returnArrivalDate', formArrDate || formDepDate || new Date().toISOString().split('T')[0]);
                }
            }
        }
    }, [formTripType, formDepDate, formArrDate, setValue, watch]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                let depDate: Date;
                const departureTime = initialData.departureTime as unknown as { seconds?: number; toDate?: () => Date };
                if (departureTime?.seconds !== undefined) {
                    depDate = new Date(departureTime.seconds * 1000);
                } else if (typeof departureTime?.toDate === 'function') {
                    depDate = departureTime.toDate();
                } else {
                    depDate = new Date(initialData.departureTime as unknown as string | number | Date);
                }
                if (isNaN(depDate.getTime())) depDate = new Date();

                let arrDate: Date;
                const arrivalTime = initialData.arrivalTime as unknown as { seconds?: number; toDate?: () => Date };
                if (arrivalTime?.seconds !== undefined) {
                    arrDate = new Date(arrivalTime.seconds * 1000);
                } else if (typeof arrivalTime?.toDate === 'function') {
                    arrDate = arrivalTime.toDate();
                } else {
                    arrDate = new Date(initialData.arrivalTime as unknown as string | number | Date);
                }
                if (isNaN(arrDate.getTime())) arrDate = new Date();

                reset({
                    type: initialData.type || 'flight',
                    airline: initialData.airline,
                    flightNumber: initialData.flightNumber,
                    departureAirport: initialData.departureAirport,
                    departureAirportCode: initialData.departureAirportCode,
                    departureDate: depDate.toISOString().split('T')[0],
                    departureTime: depDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                    arrivalAirport: initialData.arrivalAirport,
                    arrivalAirportCode: initialData.arrivalAirportCode,
                    arrivalDate: arrDate.toISOString().split('T')[0],
                    arrivalTime: arrDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                    cost: initialData.cost,
                    bookingReference: initialData.bookingReference,
                    tripType: 'oneway'
                });
            } else {
                const defDate = dayDateIso || new Date().toISOString().split('T')[0];
                reset({
                    type: 'flight',
                    departureDate: defDate,
                    arrivalDate: defDate,
                    airline: '',
                    flightNumber: '',
                    departureAirport: '',
                    departureAirportCode: '',
                    departureTime: '',
                    arrivalAirport: '',
                    arrivalAirportCode: '',
                    arrivalTime: '',
                    cost: 0,
                    bookingReference: '',
                    tripType: 'oneway',
                    returnDepartureDate: defDate,
                    returnArrivalDate: defDate,
                });
            }
        }
    }, [isOpen, initialData, dayDateIso, reset]);

    const onSubmit = async (data: TransportForm) => {
        try {
            const depart = new Date(`${data.departureDate}T${data.departureTime}`);
            const arrive = new Date(`${data.arrivalDate}T${data.arrivalTime}`);

            await onSave({
                type: data.type,
                airline: data.airline,
                flightNumber: data.flightNumber || '',
                departureAirport: data.departureAirport,
                departureAirportCode: data.departureAirportCode || '',
                departureTime: Timestamp.fromDate(depart),
                arrivalAirport: data.arrivalAirport,
                arrivalAirportCode: data.arrivalAirportCode || '',
                arrivalTime: Timestamp.fromDate(arrive),
                bookingReference: data.bookingReference || '',
                cost: data.cost || 0,
                currency: currencyCode,
            });

            if (data.tripType === 'return' && !initialData) {
                if (data.returnDepartureDate && data.returnDepartureTime && data.returnArrivalDate && data.returnArrivalTime) {
                    const rDepart = new Date(`${data.returnDepartureDate}T${data.returnDepartureTime}`);
                    const rArrive = new Date(`${data.returnArrivalDate}T${data.returnArrivalTime}`);

                    await onSave({
                        type: data.type,
                        airline: data.returnAirline || data.airline,
                        flightNumber: data.returnFlightNumber || '',
                        departureAirport: data.arrivalAirport,
                        departureAirportCode: data.arrivalAirportCode || '',
                        departureTime: Timestamp.fromDate(rDepart),
                        arrivalAirport: data.departureAirport,
                        arrivalAirportCode: data.departureAirportCode || '',
                        arrivalTime: Timestamp.fromDate(rArrive),
                        bookingReference: data.bookingReference || '',
                        cost: 0,
                        currency: currencyCode,
                    });
                }
            }

            reset();
            onClose();
        } catch (error) {
            console.error('Failed to save transportation', error);
        }
    };

    if (!isOpen) return null;

    const getLabels = () => {
        switch (transportType) {
            case 'train': return { carrier: 'Train Operator', number: 'Train Number', from: 'Departure Station', to: 'Arrival Station' };
            case 'bus': return { carrier: 'Bus Company', number: 'Line/Bus Number', from: 'Departure Stop', to: 'Arrival Stop' };
            default: return { carrier: 'Airline', number: 'Flight Number', from: 'Departure Airport', to: 'Arrival Airport' };
        }
    };

    const labels = getLabels();

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {initialData ? 'Edit Transport' : 'Add Transport'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dayDate === "Trip Duration" ? "Manage transport for the trip" : `for ${dayDate}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto">
                    {/* Transport Type Selector */}
                    <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-full">
                        {(['flight', 'train', 'bus', 'other'] as TransportType[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setValue('type', t)}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${transportType === t ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {!initialData && (
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-fit">
                            <button type="button" onClick={() => setValue('tripType', 'oneway')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tripType === 'oneway' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>One Way</button>
                            <button type="button" onClick={() => setValue('tripType', 'return')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tripType === 'return' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Return</button>
                        </div>
                    )}

                    {/* Carrier Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{labels.carrier}</label>
                            <input {...register('airline')} placeholder="e.g. Delta, Eurostar, Flixbus" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            {errors.airline && <p className="text-red-500 text-sm mt-1">{errors.airline.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{labels.number}</label>
                            <input {...register('flightNumber')} placeholder="e.g. DL123, 9032" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                    </div>

                    {/* Departure */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-1">Departure</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                                    <input {...register('departureAirportCode')} placeholder="LAX/STN" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono" />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{labels.from}</label>
                                    <input {...register('departureAirport')} placeholder="Location name" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5 sm:mb-1">Date</label>
                                    <input type="date" {...register('departureDate')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5 sm:mb-1">Time</label>
                                    <input type="time" {...register('departureTime')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Arrival */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-1">Arrival</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                                    <input {...register('arrivalAirportCode')} placeholder="HND/PAR" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono" />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{labels.to}</label>
                                    <input {...register('arrivalAirport')} placeholder="Location name" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5 sm:mb-1">Date</label>
                                    <input type="date" {...register('arrivalDate')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5 sm:mb-1">Time</label>
                                    <input type="time" {...register('arrivalTime')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booking Ref</label>
                            <input {...register('bookingReference')} placeholder="Optional" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost ({currencyCode})</label>
                            <input type="number" step="0.01" {...register('cost', { valueAsNumber: true })} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                    </div>

                    {/* Return Section */}
                    {tripType === 'return' && !initialData && (
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700 animate-fade-in">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Return {transportType}
                            </h3>

                            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 space-y-4">
                                {/* Route Reversal Info */}
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                    <div className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                        {arrCode || 'DEST'}
                                    </div>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                    <div className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                        {depCode || 'ORIG'}
                                    </div>
                                    <span className="text-xs opacity-75">(Reversed Route)</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">{labels.carrier}</label>
                                        <input {...register('returnAirline')} placeholder="Same as outbound if empty" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">{labels.number}</label>
                                        <input {...register('returnFlightNumber')} placeholder="Return number" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Return Departure */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Departure (Return)</h4>
                                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                            <input type="date" {...register('returnDepartureDate')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                            <input type="time" {...register('returnDepartureTime')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                        </div>
                                    </div>

                                    {/* Return Arrival */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Arrival (Return)</h4>
                                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                            <input type="date" {...register('returnArrivalDate')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                            <input type="time" {...register('returnArrivalTime')} className="w-full px-1 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-primary-500 outline-none text-[11px] sm:text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-800/50">
                    {initialData && onDelete && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirm('Are you sure you want to delete this transport?')) {
                                    try {
                                        const idToDelete = initialData.id || '';
                                        if (idToDelete) {
                                            await onDelete(idToDelete);
                                        }
                                        onClose();
                                    } catch (err) {
                                        console.error('Failed to delete transport:', err);
                                    }
                                }
                            }}
                            className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mr-auto"
                        >
                            Delete
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 font-semibold">Cancel</button>
                    <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="px-8 py-2 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50">Save</button>
                </div>
            </div>
        </div>
    );
}
