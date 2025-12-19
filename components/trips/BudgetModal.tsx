'use client';

import { useState, useEffect } from 'react';
import { Trip, TripBudget } from '@/types';

interface BudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    trip: Trip;
    onSave: (budget: TripBudget) => Promise<void>;
}

export default function BudgetModal({ isOpen, onClose, trip, onSave }: BudgetModalProps) {
    const [budget, setBudget] = useState<TripBudget>(trip.budget || {
        totalBudget: 0,
        currency: 'USD',
        categories: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 },
        actualSpending: { flights: 0, accommodation: 0, food: 0, activities: 0, shopping: 0, transportation: 0, other: 0 }
    });

    useEffect(() => {
        if (trip.budget) {
            setBudget(trip.budget);
        }
    }, [trip.budget]);

    if (!isOpen) return null;

    const totalSpent = Object.values(budget.actualSpending).reduce((sum, val) => sum + (val || 0), 0);
    const balance = (budget.totalBudget || 0) - totalSpent;
    const isOverBudget = balance < 0;

    const handleSave = async () => {
        await onSave(budget);
        onClose();
    };

    const categories = [
        { key: 'flights', label: 'Flights', icon: '✈️' },
        { key: 'accommodation', label: 'Stays', icon: '🏨' },
        { key: 'food', label: 'Food', icon: '🍽️' },
        { key: 'activities', label: 'Activities', icon: '🎢' },
        { key: 'shopping', label: 'Shopping', icon: '🛍️' },
        { key: 'transportation', label: 'Local Transport', icon: '🚕' },
        { key: 'other', label: 'Other', icon: '📦' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-primary-500 to-primary-600 border-none">
                    <div className="flex justify-between items-center text-white">
                        <h2 className="text-2xl font-bold">Trip Budget</h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto max-h-[70vh] p-6 space-y-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Budget</p>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-400">{budget.currency}</span>
                                <input
                                    type="number"
                                    value={budget.totalBudget || ''}
                                    onChange={(e) => setBudget({ ...budget, totalBudget: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-xl font-bold text-gray-900 dark:text-white focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Actual Spent</p>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">
                                {budget.currency} {totalSpent.toLocaleString()}
                            </div>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isOverBudget ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30'}`}>
                            <p className={`text-xs mb-1 ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                                {isOverBudget ? 'Over Budget' : 'Remaining'}
                            </p>
                            <div className={`text-xl font-bold ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {budget.currency} {Math.abs(balance).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">Category Breakdown</h3>
                        <div className="space-y-3">
                            {categories.map((cat) => {
                                const spent = budget.actualSpending[cat.key as keyof typeof budget.actualSpending] || 0;
                                const limit = budget.categories[cat.key as keyof typeof budget.categories] || 0;
                                const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;

                                return (
                                    <div key={cat.key} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary-500/30 transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{cat.icon}</span>
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{cat.label}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className="text-xs text-gray-400">Limit: {budget.currency}</span>
                                                    <input
                                                        type="number"
                                                        value={limit || ''}
                                                        onChange={(e) => {
                                                            const newCats = { ...budget.categories, [cat.key]: parseFloat(e.target.value) || 0 };
                                                            setBudget({ ...budget, categories: newCats });
                                                        }}
                                                        className="w-16 bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded text-sm text-center font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                                                    Spent: {budget.currency} {spent.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        {limit > 0 && (
                                            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${spent > limit ? 'bg-red-500' : 'bg-primary-500'}`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 transition-all active:scale-95"
                    >
                        Save Budget
                    </button>
                </div>
            </div>
        </div>
    );
}
