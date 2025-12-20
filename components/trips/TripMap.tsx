'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { Activity, AccommodationDetails, TransportationDetails } from '@/types';

// Dynamically import Map components to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });

// For useMap, we need to access it within a component that is a child of MapContainer
// We'll import the whole module dynamically and pick what we need
let useMapHook: any;
import('react-leaflet').then(mod => { useMapHook = mod.useMap; });

interface TripMapProps {
    activities: Activity[];
    accommodations: AccommodationDetails[];
    transportation: TransportationDetails[];
    activeDayId?: string | null;
    focusedId?: string | null;
    onMarkerClick?: (id: string, type: 'activity' | 'stay') => void;
    className?: string;
}

// Internal component to handle view changes
function MapController({ bounds }: { bounds: any }) {
    const [useMap, setUseMap] = useState<any>(null);

    useEffect(() => {
        import('react-leaflet').then(mod => {
            setUseMap(() => mod.useMap);
        });
    }, []);

    const map = useMap ? useMap() : null;

    useEffect(() => {
        if (map && bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [bounds, map]);
    return null;
}

export default function TripMap({
    activities,
    accommodations,
    transportation,
    activeDayId,
    focusedId,
    onMarkerClick,
    className = "h-full w-full"
}: TripMapProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [L, setL] = useState<any>(null);

    useEffect(() => {
        setIsMounted(true);
        import('leaflet').then(leaflet => {
            setL(leaflet);
            // Fix Leaflet icon issue
            // @ts-ignore
            delete leaflet.Icon.Default.prototype._getIconUrl;
            leaflet.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            });
        });
    }, []);

    if (!isMounted || !L) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`}>
                <div className="text-gray-400 font-medium">Loading Map...</div>
            </div>
        );
    }

    // Filter pins by active day if applicable
    const activeActivities = activeDayId
        ? activities.filter(a => (a as any).dayId === activeDayId)
        : activities;

    const activeStays = activeDayId
        ? accommodations.filter(s => (s as any).dayId === activeDayId)
        : accommodations;

    const pins = [
        ...activeActivities.map(a => ({
            id: a.id,
            type: 'activity' as const,
            name: a.name,
            lat: a.location.latitude,
            lng: a.location.longitude,
            category: a.type
        })),
        ...activeStays.map(s => ({
            id: s.id,
            type: 'stay' as const,
            name: s.name,
            lat: s.location.latitude,
            lng: s.location.longitude,
            category: 'accommodation'
        }))
    ].filter(p => typeof p.lat === 'number' && typeof p.lng === 'number' && (Math.abs(p.lat) > 0.0001 || Math.abs(p.lng) > 0.0001));

    const bounds = pins.length > 0 ? pins.map(p => [p.lat, p.lng]) : [[0, 0]];
    const center = pins.length > 0 ? [pins[0].lat, pins[0].lng] : [0, 0];

    // Create polyline logic for routes
    const routeCoordinates = pins
        .sort((a, b) => {
            // Very simple sort for route display
            if (a.type === b.type) return 0;
            return a.type === 'stay' ? -1 : 1;
        })
        .map(p => [p.lat, p.lng]);

    const getIcon = (type: string, category: string, isFocused: boolean) => {
        const color = type === 'stay' ? '#8b5cf6' : '#0ea5e9'; // Purple for stay, Blue for activity
        const size = isFocused ? 40 : 30;

        return L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div style="
                    background-color: ${color}; 
                    width: ${size}px; 
                    height: ${size}px; 
                    border-radius: 50% 50% 50% 0; 
                    transform: rotate(-45deg) ${isFocused ? 'scale(1.2)' : ''}; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    border: 3px solid white;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                ">
                    <div style="transform: rotate(45deg); color: white; font-size: 14px;">
                        ${type === 'stay' ? '🏠' : '📍'}
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -size],
        });
    };

    return (
        <div className={className}>
            <MapContainer
                // @ts-ignore
                center={center as [number, number]}
                zoom={13}
                scrollWheelZoom={true}
                className="h-full w-full rounded-2xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-700"
            >
                <TileLayer
                    // @ts-ignore
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {pins.map(pin => (
                    <Marker
                        key={pin.id}
                        // @ts-ignore
                        position={[pin.lat, pin.lng]}
                        icon={getIcon(pin.type, pin.category, focusedId === pin.id)}
                        eventHandlers={{
                            click: () => onMarkerClick?.(pin.id, pin.type),
                        }}
                    >
                        <Popup>
                            <div className="font-bold text-gray-900">{pin.name}</div>
                            <div className="text-xs text-gray-500 capitalize">{pin.category}</div>
                        </Popup>
                    </Marker>
                ))}

                {routeCoordinates.length > 1 && (
                    <Polyline
                        // @ts-ignore
                        positions={routeCoordinates}
                        color="#6366f1"
                        weight={3}
                        dashArray="10, 10"
                        opacity={0.6}
                    />
                )}

                <MapController bounds={bounds} />
            </MapContainer>
        </div>
    );
}
