import { Timestamp } from 'firebase/firestore';
import type { AccommodationDetails, DayPlan, TransportationDetails, Trip } from '@/types';

export const GUEST_TRIPS_STORAGE_KEY = 'travel_blog_guest_trips';

export const getUserCacheKey = (uid: string) => `travel_blog_user_cache_${uid}`;

function toISOString(dateValue: unknown): string {
  if (!dateValue) return new Date().toISOString();

  if (dateValue instanceof Timestamp) return dateValue.toDate().toISOString();
  if (dateValue instanceof Date) return dateValue.toISOString();
  if (typeof dateValue === 'string') return new Date(dateValue).toISOString();

  // Firestore Timestamp-like object (e.g. { seconds, nanoseconds })
  if (typeof dateValue === 'object' && dateValue !== null && 'seconds' in dateValue) {
    const seconds = (dateValue as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString();
  }

  try {
    return new Date(String(dateValue)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function toTimestamp(value: unknown, fallback: Timestamp = Timestamp.now()): Timestamp {
  if (!value) return fallback;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);

  if (typeof value === 'string') {
    const d = new Date(value);
    return Timestamp.fromDate(isNaN(d.getTime()) ? fallback.toDate() : d);
  }

  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number') return Timestamp.fromMillis(seconds * 1000);
  }

  try {
    const d = new Date(typeof value === 'number' ? value : String(value));
    return Timestamp.fromDate(isNaN(d.getTime()) ? fallback.toDate() : d);
  } catch {
    return fallback;
  }
}

export function serializeTripsForStorage(trips: Trip[]): unknown[] {
  return trips.map((t) => ({
    ...t,
    startDate: toISOString(t.startDate),
    endDate: toISOString(t.endDate),
    createdAt: toISOString(t.createdAt),
    updatedAt: toISOString(t.updatedAt),
    transportation: (t.transportation || []).map((f: TransportationDetails) => ({
      ...f,
      departureTime: toISOString(f.departureTime),
      arrivalTime: toISOString(f.arrivalTime),
    })),
    days: (t.days || []).map((d: DayPlan) => ({
      ...d,
      date: toISOString(d.date),
      transportation: (d.transportation || []).map((f: TransportationDetails) => ({
        ...f,
        departureTime: toISOString(f.departureTime),
        arrivalTime: toISOString(f.arrivalTime),
      })),
      customOrder: d.customOrder || [],
    })),
  }));
}

export function deserializeTripsFromStorage(raw: string): Trip[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed.map((tripRaw: unknown) => {
    const tripObj = (tripRaw ?? {}) as Record<string, unknown>;
    const baseTrip = tripObj as unknown as Trip;

    const transportationRaw = Array.isArray(tripObj.transportation) ? tripObj.transportation : [];
    const transportation = transportationRaw.map((fRaw: unknown) => {
      const fObj = (fRaw ?? {}) as Record<string, unknown>;
      const baseF = fObj as unknown as TransportationDetails;
      return {
        ...baseF,
        departureTime: toTimestamp(fObj.departureTime),
        arrivalTime: toTimestamp(fObj.arrivalTime),
      } as TransportationDetails;
    });

    const daysRaw = Array.isArray(tripObj.days) ? tripObj.days : [];
    const days = daysRaw.map((dRaw: unknown) => {
      const dObj = (dRaw ?? {}) as Record<string, unknown>;
      const baseD = dObj as unknown as DayPlan;

      // Legacy support: some exports used `flights` instead of `transportation`
      const legacyFlights = Array.isArray(dObj.flights) ? dObj.flights : [];
      const dayTransportationRaw = Array.isArray(dObj.transportation) ? dObj.transportation : legacyFlights;
      const dayTransportation = dayTransportationRaw.map((fRaw: unknown) => {
        const fObj = (fRaw ?? {}) as Record<string, unknown>;
        const baseF = fObj as unknown as TransportationDetails;
        return {
          ...baseF,
          departureTime: toTimestamp(fObj.departureTime),
          arrivalTime: toTimestamp(fObj.arrivalTime),
        } as TransportationDetails;
      });

      return {
        ...baseD,
        date: toTimestamp(dObj.date),
        transportation: dayTransportation,
        accommodation: dObj.accommodation ? (dObj.accommodation as unknown as AccommodationDetails) : undefined,
      } as DayPlan;
    });

    return {
      ...baseTrip,
      startDate: toTimestamp(tripObj.startDate),
      endDate: toTimestamp(tripObj.endDate),
      createdAt: toTimestamp(tripObj.createdAt),
      updatedAt: toTimestamp(tripObj.updatedAt),
      transportation,
      days,
    } as Trip;
  });
}

export function saveTripsToLocalStorage(trips: Trip[], key: string = GUEST_TRIPS_STORAGE_KEY) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(serializeTripsForStorage(trips)));
}

export function loadTripsFromLocalStorage(key: string = GUEST_TRIPS_STORAGE_KEY): Trip[] | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return deserializeTripsFromStorage(raw);
}


