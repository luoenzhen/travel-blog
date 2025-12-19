'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Media } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import Image from 'next/image';

const photoSchema = z.object({
    caption: z.string().optional(),
});

type PhotoForm = z.infer<typeof photoSchema>;

interface AddPhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Media) => Promise<void>;
    dayDate: string;
    dayId: string;
}

export default function AddPhotoModal({ isOpen, onClose, onSave, dayDate, dayId }: AddPhotoModalProps) {
    const [selectedImages, setSelectedImages] = useState<Array<{ webPath: string; blob?: Blob; id: string }>>([]);

    const {
        register,
        handleSubmit,
        reset,
    } = useForm<PhotoForm>({
        resolver: zodResolver(photoSchema),
        defaultValues: {
            caption: ''
        }
    });

    const handlePickImage = async () => {
        try {
            console.log('Starting camera capture');
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera
            });

            if (image.webPath) {
                const response = await fetch(image.webPath);
                const blob = await response.blob();
                setSelectedImages(prev => [...prev, {
                    webPath: image.webPath!,
                    blob,
                    id: crypto.randomUUID()
                }]);
            }
        } catch (error) {
            console.error('Failed to take photo', error);
        }
    };

    const handlePickImages = async () => {
        try {
            console.log('Starting gallery multiple pick');
            const result = await Camera.pickImages({
                quality: 90,
                limit: 10 // Reasonable limit
            });

            if (result.photos.length > 0) {
                const newPhotos = await Promise.all(result.photos.map(async (photo) => {
                    const response = await fetch(photo.webPath);
                    const blob = await response.blob();
                    return {
                        webPath: photo.webPath,
                        blob,
                        id: crypto.randomUUID()
                    };
                }));
                setSelectedImages(prev => [...prev, ...newPhotos]);
            }
        } catch (error) {
            console.error('Failed to pick images', error);
        }
    };

    const removeImage = (id: string) => {
        setSelectedImages(prev => prev.filter(img => img.id !== id));
    };

    const onSubmit = async (data: PhotoForm) => {
        if (selectedImages.length === 0) {
            console.warn('No images selected');
            return;
        }

        try {
            console.log(`Adding ${selectedImages.length} local photo references for day: ${dayId}`);

            for (const img of selectedImages) {
                const newPhoto: Media = {
                    id: crypto.randomUUID(),
                    type: 'image',
                    url: img.webPath,
                    caption: data.caption,
                    uploadedAt: Timestamp.now(),
                    size: img.blob?.size || 0,
                    mimeType: img.blob?.type || 'image/jpeg'
                };
                await onSave(newPhoto);
            }

            handleClose();
        } catch (error) {
            console.error('Failed to save photo references', error);
            alert(`Failed to save photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleClose = () => {
        reset();
        setSelectedImages([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Photos</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">for {dayDate}</p>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        {selectedImages.map((img) => (
                            <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 group">
                                <Image
                                    src={img.webPath}
                                    alt="Selected"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                                <button
                                    onClick={() => removeImage(img.id)}
                                    className="absolute top-1.5 right-1.5 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={handlePickImage}
                            className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
                        >
                            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Take Photo</span>
                        </button>

                        <button
                            onClick={handlePickImages}
                            className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
                        >
                            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Gallery</span>
                        </button>
                    </div>

                    {selectedImages.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Shared Caption
                            </label>
                            <textarea
                                {...register('caption')}
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                                placeholder="Describe these photos..."
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-white dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit(onSubmit)}
                            disabled={selectedImages.length === 0}
                            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Add {selectedImages.length > 0 ? `${selectedImages.length} ` : ''}Photo{selectedImages.length !== 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
