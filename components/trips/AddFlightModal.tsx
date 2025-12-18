'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FlightDetails } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { CURRENCIES } from '@/lib/constants';

const flightSchema = z.object({
    airline: z.string().min(2, 'Airline is required'),
    flightNumber: z.string().min(2, 'Flight number is required'),
    departureAirport: z.string().min(3, 'Airport code/name required'),
    departureAirportCode: z.string().length(3, '3-letter code required').toUpperCase(),
    departureDate: z.string().min(1, 'Date is required'),
    departureTime: z.string().min(1, 'Time is required'),
    arrivalAirport: z.string().min(3, 'Airport code/name required'),
    arrivalAirportCode: z.string().length(3, '3-letter code required').toUpperCase(),
    arrivalDate: z.string().min(1, 'Date is required'),
    arrivalTime: z.string().min(1, 'Time is required'),
    cost: z.number().min(0).optional(),
    bookingReference: z.string().optional(),

    // Return Flight Logic
    tripType: z.enum(['oneway', 'return']),
    returnAirline: z.string().optional(),
    returnFlightNumber: z.string().optional(),
    returnDepartureDate: z.string().optional(),
    returnDepartureTime: z.string().optional(),
    returnArrivalDate: z.string().optional(),
    returnArrivalTime: z.string().optional(),
});

type FlightForm = z.infer<typeof flightSchema>;

interface AddFlightModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<FlightDetails>) => Promise<void>;
    dayDate?: string; // Optional context, usually global now
    dayDateIso?: string; // Default date if creating new
    currencyCode?: string;
    initialData?: FlightDetails;
    onDelete?: (id: string) => Promise<void>;
}

export default function AddFlightModal({ isOpen, onClose, onSave, onDelete, dayDate, dayDateIso, currencyCode = 'USD', initialData }: AddFlightModalProps) {
    const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || '$';

    // State for toggling trip type (Only UI, but synced with form)
    const [tripType, setTripType] = useState<'oneway' | 'return'>('oneway');
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FlightForm>({
        resolver: zodResolver(flightSchema),
        defaultValues: {
            cost: 0,
            tripType: 'oneway'
        }
    });

    // Watch fields for auto-filling return trip
    const depCode = watch('departureAirportCode');
    const arrCode = watch('arrivalAirportCode');

    // Sync tripType state with form
    // Sync tripType state with form and pre-fill return dates
    const formTripType = watch('tripType');
    const formDepDate = watch('departureDate');
    const formArrDate = watch('arrivalDate');

    useEffect(() => {
        if (formTripType) {
            setTripType(formTripType);

            // Auto-populate return dates if switching to 'return' and empty
            if (formTripType === 'return') {
                const currentReturnDep = watch('returnDepartureDate');
                if (!currentReturnDep) {
                    setValue('returnDepartureDate', formArrDate || formDepDate || new Date().toISOString().split('T')[0]);
                }
                const currentReturnArr = watch('returnArrivalDate');
                if (!currentReturnArr) {
                    setValue('returnArrivalDate', formArrDate || formDepDate || new Date().toISOString().split('T')[0]);
                }
            }
        }
    }, [formTripType, formDepDate, formArrDate, setValue, watch]);



    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Editing
                // Safely convert Timestamp or Date
                // @ts-ignore - Handle mixed types from store
                let depDate: Date;
                // @ts-ignore
                if ((initialData.departureTime as any)?.seconds !== undefined) {
                    // @ts-ignore
                    depDate = new Date((initialData.departureTime as any).seconds * 1000);
                } else if (initialData.departureTime && typeof initialData.departureTime.toDate === 'function') {
                    depDate = initialData.departureTime.toDate();
                } else {
                    depDate = new Date(initialData.departureTime as any);
                }
                if (isNaN(depDate.getTime())) depDate = new Date();

                // @ts-ignore
                let arrDate: Date;
                // @ts-ignore
                if ((initialData.arrivalTime as any)?.seconds !== undefined) {
                    // @ts-ignore
                    arrDate = new Date((initialData.arrivalTime as any).seconds * 1000);
                } else if (initialData.arrivalTime && typeof initialData.arrivalTime.toDate === 'function') {
                    arrDate = initialData.arrivalTime.toDate();
                } else {
                    arrDate = new Date(initialData.arrivalTime as any);
                }
                if (isNaN(arrDate.getTime())) arrDate = new Date();

                reset({
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
                    bookingReference: initialData.bookingReference
                });
            } else {
                // Creating
                const defDate = dayDateIso || new Date().toISOString().split('T')[0];
                reset({
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
                    // Default Return Dates to avoid ugly empty mask
                    returnDepartureDate: defDate,
                    returnArrivalDate: defDate,
                });
            }
        }
    }, [isOpen, initialData, dayDateIso, reset]);

    const onSubmit = async (data: FlightForm) => {
        console.log('onSubmit called with data:', data);
        try {
            const departUrl = `${data.departureDate}T${data.departureTime}`;
            const arriveUrl = `${data.arrivalDate}T${data.arrivalTime}`;
            console.log('Constructed dates:', departUrl, arriveUrl);

            const depart = new Date(departUrl);
            const arrive = new Date(arriveUrl);
            console.log('Date objects:', depart, arrive);

            console.log('Calling onSave...');
            await onSave({
                airline: data.airline,
                flightNumber: data.flightNumber,
                departureAirport: data.departureAirport,
                departureAirportCode: data.departureAirportCode,
                departureTime: Timestamp.fromDate(depart),
                arrivalAirport: data.arrivalAirport,
                arrivalAirportCode: data.arrivalAirportCode,
                arrivalTime: Timestamp.fromDate(arrive),
                bookingReference: data.bookingReference || '',
                cost: data.cost || 0,
                currency: currencyCode,
            });
            console.log('onSave completed.');

            // 2. Return Flight (if enabled)
            if (data.tripType === 'return') {
                console.log('Processing return flight...');
                if (data.returnDepartureDate && data.returnDepartureTime && data.returnArrivalDate && data.returnArrivalTime) {
                    const rDepartUrl = `${data.returnDepartureDate}T${data.returnDepartureTime}`;
                    const rArriveUrl = `${data.returnArrivalDate}T${data.returnArrivalTime}`;
                    const rDepart = new Date(rDepartUrl);
                    const rArrive = new Date(rArriveUrl);

                    await onSave({
                        airline: data.returnAirline || data.airline,
                        flightNumber: data.returnFlightNumber || '',
                        departureAirport: data.arrivalAirport, // Swapped
                        departureAirportCode: data.arrivalAirportCode, // Swapped
                        departureTime: Timestamp.fromDate(rDepart),
                        arrivalAirport: data.departureAirport, // Swapped
                        arrivalAirportCode: data.departureAirportCode, // Swapped
                        arrivalTime: Timestamp.fromDate(rArrive),
                        bookingReference: data.bookingReference || '',
                        cost: 0,
                        currency: currencyCode,
                    });
                }
            }

            console.log('Resetting and closing...');
            reset();
            onClose();
        } catch (error) {
            console.error('Failed to save flight', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {initialData ? 'Edit Flight' : 'Add Flight'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dayDate === "Trip Duration" ? "Manage flights for the trip" : `for ${dayDate}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto">
                    {/* Trip Type Toggle (Only when creating) */}
                    {!initialData && (
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-fit">
                            <button
                                type="button"
                                onClick={() => setValue('tripType', 'oneway')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tripType === 'oneway' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                One Way
                            </button>
                            <button
                                type="button"
                                onClick={() => setValue('tripType', 'return')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tripType === 'return' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                Return
                            </button>
                        </div>
                    )}
                    {/* Airline Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Airline</label>
                            <input {...register('airline')} placeholder="e.g. Delta" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            {errors.airline && <p className="text-red-500 text-sm mt-1">{errors.airline.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flight Number</label>
                            <input {...register('flightNumber')} placeholder="e.g. DL123" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            {errors.flightNumber && <p className="text-red-500 text-sm mt-1">{errors.flightNumber.message}</p>}
                        </div>
                    </div>

                    {/* Departure */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-1">Departure</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Row 1: Location */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                                <input {...register('departureAirportCode')} placeholder="LAX" maxLength={3} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono" />
                                {errors.departureAirportCode && <p className="text-red-500 text-xs mt-1">{errors.departureAirportCode.message}</p>}
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Airport Name</label>
                                <input {...register('departureAirport')} placeholder="Los Angeles Intl" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>

                            {/* Row 2: Time */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        {...register('departureDate')}
                                        onFocus={(e) => {
                                            e.target.type = 'date';
                                            if (!e.target.value) {
                                                setValue('departureDate', new Date().toISOString().split('T')[0], { shouldValidate: true });
                                            }
                                        }}
                                        onBlur={(e) => {
                                            if (!e.target.value) e.target.type = 'text';
                                            register('departureDate').onBlur(e);
                                        }}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                {errors.departureDate && <p className="text-red-500 text-xs mt-1">{errors.departureDate.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                                <div className="relative">
                                    <input type="time" {...register('departureTime')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                {errors.departureTime && <p className="text-red-500 text-xs mt-1">{errors.departureTime.message}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Arrival */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-1">Arrival</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Row 1: Location */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                                <input {...register('arrivalAirportCode')} placeholder="HND" maxLength={3} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono" />
                                {errors.arrivalAirportCode && <p className="text-red-500 text-xs mt-1">{errors.arrivalAirportCode.message}</p>}
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Airport Name</label>
                                <input {...register('arrivalAirport')} placeholder="Haneda" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>

                            {/* Row 2: Time */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        {...register('arrivalDate')}
                                        onFocus={(e) => {
                                            e.target.type = 'date';
                                            if (!e.target.value) {
                                                setValue('arrivalDate', new Date().toISOString().split('T')[0], { shouldValidate: true });
                                            }
                                        }}
                                        onBlur={(e) => {
                                            if (!e.target.value) e.target.type = 'text';
                                            register('arrivalDate').onBlur(e);
                                        }}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                {errors.arrivalDate && <p className="text-red-500 text-xs mt-1">{errors.arrivalDate.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                                <div className="relative">
                                    <input type="time" {...register('arrivalTime')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                {errors.arrivalTime && <p className="text-red-500 text-xs mt-1">{errors.arrivalTime.message}</p>}
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
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">{currencySymbol}</span>
                                </div>
                                <input
                                    {...register('cost', {
                                        valueAsNumber: true,
                                        setValueAs: (value) => {
                                            if (typeof value === 'string') {
                                                if (value.trim() === '') return undefined;
                                                try {
                                                    if (/^[0-9+\-*/().\s]+$/.test(value)) {
                                                        // eslint-disable-next-line
                                                        return Number(new Function(`return ${value}`)());
                                                    }
                                                } catch (e) {
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

                    {/* Return Flight Section */}
                    {tripType === 'return' && !initialData && (
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700 animate-fade-in">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Return Flight
                            </h3>

                            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 space-y-4">
                                {/* Auto-Reversed Route Info */}
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
                                    <span className="text-xs opacity-75">(Reversed from Outbound)</span>
                                </div>

                                {/* Return Airline */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Return Airline</label>
                                        <input {...register('returnAirline')} placeholder="Same as outbound if empty" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Return Flight No.</label>
                                        <input {...register('returnFlightNumber')} placeholder="e.g. DL124" className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                    </div>
                                </div>

                                {/* Return Dates */}
                                <div className="space-y-4">
                                    {/* Return Departure */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-1">Departure (Return)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                                <input
                                                    type="text"
                                                    placeholder={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    {...register('returnDepartureDate')}
                                                    onFocus={(e) => {
                                                        e.target.type = 'date';
                                                        if (!e.target.value) {
                                                            setValue('returnDepartureDate', new Date().toISOString().split('T')[0], { shouldValidate: true });
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value) e.target.type = 'text';
                                                        register('returnDepartureDate').onBlur(e);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                                                <input type="time" {...register('returnDepartureTime')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Return Arrival */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-1">Arrival (Return)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                                <input
                                                    type="text"
                                                    placeholder={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    {...register('returnArrivalDate')}
                                                    onFocus={(e) => {
                                                        e.target.type = 'date';
                                                        if (!e.target.value) {
                                                            setValue('returnArrivalDate', new Date().toISOString().split('T')[0], { shouldValidate: true });
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value) e.target.type = 'text';
                                                        register('returnArrivalDate').onBlur(e);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                                                <input type="time" {...register('returnArrivalTime')} className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none" />
                                            </div>
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
                            onClick={() => {
                                if (confirm('Are you sure you want to delete this flight?')) {
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
                        onClick={handleSubmit(onSubmit, (errors) => console.error('Form Validation Errors:', errors))}
                        disabled={isSubmitting}
                        className="px-8 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                        {initialData ? 'Save Changes' : 'Add Flight'}
                    </button>
                </div>
            </div>
        </div>
    );
}
