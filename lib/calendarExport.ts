import { Trip, Activity, TransportationDetails, AccommodationDetails } from '@/types';
import { addHours } from 'date-fns';

// Helper to convert various date formats to Date object
const toDate = (date: unknown): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (typeof date === 'object' && date !== null) {
        const d = date as Record<string, unknown>;
        if (typeof d.toDate === 'function') {
            return (d.toDate as () => Date)();
        }
        if (typeof d.seconds === 'number') {
            return new Date(d.seconds * 1000);
        }
    }
    if (typeof date === 'string') return new Date(date);
    return new Date();
};

// Parse time string like "10:00 AM" or "14:00" to hours and minutes
const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    if (!timeStr) return { hours: 9, minutes: 0 }; // Default to 9 AM

    // Try to parse "HH:MM AM/PM" format
    const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match12) {
        let hours = parseInt(match12[1], 10);
        const minutes = parseInt(match12[2], 10);
        const period = match12[3]?.toUpperCase();

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        return { hours, minutes };
    }

    return { hours: 9, minutes: 0 };
};

// Format date to ICS format: YYYYMMDDTHHMMSS
const formatICSDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

// Escape special characters for ICS format
const escapeICS = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
};

// Generate unique ID for calendar event
const generateUID = (prefix: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}-${timestamp}-${random}@travelblog`;
};

interface CalendarEvent {
    uid: string;
    summary: string;
    description: string;
    location?: string;
    dtstart: string;
    dtend: string;
    allDay?: boolean;
    categories?: string[];
}

// Build ICS content from events
const buildICSContent = (events: CalendarEvent[], calendarName: string): string => {
    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Travel Blog//Trip Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeICS(calendarName)}`,
    ];

    for (const event of events) {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${event.uid}`);
        lines.push(`DTSTAMP:${formatICSDate(new Date())}`);

        if (event.allDay) {
            lines.push(`DTSTART;VALUE=DATE:${event.dtstart}`);
            lines.push(`DTEND;VALUE=DATE:${event.dtend}`);
        } else {
            lines.push(`DTSTART:${event.dtstart}`);
            lines.push(`DTEND:${event.dtend}`);
        }

        lines.push(`SUMMARY:${escapeICS(event.summary)}`);

        if (event.description) {
            lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
        }

        if (event.location) {
            lines.push(`LOCATION:${escapeICS(event.location)}`);
        }

        if (event.categories && event.categories.length > 0) {
            lines.push(`CATEGORIES:${event.categories.map(escapeICS).join(',')}`);
        }

        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
};

// Convert trip activities to calendar events
const activityToEvent = (activity: Activity, dayDate: Date): CalendarEvent => {
    const startTime = parseTime(activity.startTime);
    const endTime = parseTime(activity.endTime);

    const startDate = new Date(dayDate);
    startDate.setHours(startTime.hours, startTime.minutes, 0, 0);

    let endDate = new Date(dayDate);
    endDate.setHours(endTime.hours, endTime.minutes, 0, 0);

    // If end time is before start time, assume it's the next day or set default duration
    if (endDate <= startDate) {
        endDate = addHours(startDate, 2); // Default 2 hour duration
    }

    const description = [
        activity.description,
        activity.notes ? `Notes: ${activity.notes}` : null,
        activity.tips ? `Tips: ${activity.tips}` : null,
        activity.cost ? `Cost: ${activity.currency || '$'}${activity.cost}` : null,
        activity.bookingConfirmation ? `Booking: ${activity.bookingConfirmation}` : null,
    ].filter(Boolean).join('\n');

    return {
        uid: generateUID(`activity-${activity.id}`),
        summary: `🎯 ${activity.name}`,
        description,
        location: activity.location?.name || activity.location?.address,
        dtstart: formatICSDate(startDate),
        dtend: formatICSDate(endDate),
        categories: ['Activity', activity.type || 'other'],
    };
};

// Convert transport to calendar event
const transportToEvent = (transport: TransportationDetails): CalendarEvent => {
    const departureDate = toDate(transport.departureTime);
    const arrivalDate = toDate(transport.arrivalTime);

    const typeEmoji = {
        flight: '✈️',
        train: '🚄',
        bus: '🚌',
        other: '🚗',
    };

    const emoji = typeEmoji[transport.type] || '🚗';

    const description = [
        `${transport.departureAirport} (${transport.departureAirportCode}) → ${transport.arrivalAirport} (${transport.arrivalAirportCode})`,
        transport.airline ? `Carrier: ${transport.airline}` : null,
        transport.flightNumber ? `${transport.type === 'flight' ? 'Flight' : 'Number'}: ${transport.flightNumber}` : null,
        transport.bookingReference ? `Booking Ref: ${transport.bookingReference}` : null,
        transport.gate ? `Gate: ${transport.gate}` : null,
        transport.seat ? `Seat: ${transport.seat}` : null,
        transport.notes ? `Notes: ${transport.notes}` : null,
    ].filter(Boolean).join('\n');

    return {
        uid: generateUID(`transport-${transport.id}`),
        summary: `${emoji} ${transport.flightNumber || transport.airline} - ${transport.departureAirportCode} to ${transport.arrivalAirportCode}`,
        description,
        location: transport.departureAirport,
        dtstart: formatICSDate(departureDate),
        dtend: formatICSDate(arrivalDate),
        categories: ['Transport', transport.type],
    };
};

// Convert accommodation to check-in/check-out events
const accommodationToEvents = (stay: AccommodationDetails): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    if (stay.checkInDate) {
        const checkInDate = new Date(stay.checkInDate);
        const checkInTime = parseTime(stay.checkInTime || '15:00');
        checkInDate.setHours(checkInTime.hours, checkInTime.minutes, 0, 0);

        events.push({
            uid: generateUID(`checkin-${stay.id}`),
            summary: `🏨 Check-in: ${stay.name}`,
            description: [
                `Address: ${stay.address}`,
                `Room: ${stay.roomType || 'Standard'}`,
                stay.bookingConfirmation ? `Booking: ${stay.bookingConfirmation}` : null,
                stay.phone ? `Phone: ${stay.phone}` : null,
                stay.notes ? `Notes: ${stay.notes}` : null,
            ].filter(Boolean).join('\n'),
            location: stay.address,
            dtstart: formatICSDate(checkInDate),
            dtend: formatICSDate(addHours(checkInDate, 1)),
            categories: ['Accommodation', 'Check-in'],
        });
    }

    if (stay.checkOutDate) {
        const checkOutDate = new Date(stay.checkOutDate);
        const checkOutTime = parseTime(stay.checkOutTime || '11:00');
        checkOutDate.setHours(checkOutTime.hours, checkOutTime.minutes, 0, 0);

        events.push({
            uid: generateUID(`checkout-${stay.id}`),
            summary: `🏨 Check-out: ${stay.name}`,
            description: `Don't forget to check out from ${stay.name}!`,
            location: stay.address,
            dtstart: formatICSDate(checkOutDate),
            dtend: formatICSDate(addHours(checkOutDate, 1)),
            categories: ['Accommodation', 'Check-out'],
        });
    }

    return events;
};

// Main export function
export const generateTripCalendar = (trip: Trip): string => {
    const events: CalendarEvent[] = [];

    // Add transportation events
    if (trip.transportation) {
        for (const transport of trip.transportation) {
            events.push(transportToEvent(transport));
        }
    }

    // Add accommodation check-in/check-out events
    if (trip.stays) {
        for (const stay of trip.stays) {
            events.push(...accommodationToEvents(stay));
        }
    }

    // Add activity events for each day
    if (trip.days) {
        for (const day of trip.days) {
            const dayDate = toDate(day.date);

            if (day.activities) {
                for (const activity of day.activities) {
                    events.push(activityToEvent(activity, dayDate));
                }
            }
        }
    }

    return buildICSContent(events, `${trip.title} - Itinerary`);
};

// Generate Google Calendar URL for a single event
export const generateGoogleCalendarUrl = (event: {
    title: string;
    description?: string;
    location?: string;
    startDate: Date;
    endDate: Date;
}): string => {
    const formatGoogleDate = (date: Date): string => {
        return date.toISOString().replace(/-|:|\.\d{3}/g, '');
    };

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
    });

    if (event.description) {
        params.append('details', event.description);
    }

    if (event.location) {
        params.append('location', event.location);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// Generate all Google Calendar URLs for a trip
export const generateGoogleCalendarUrls = (trip: Trip): { title: string; url: string; type: string }[] => {
    const urls: { title: string; url: string; type: string }[] = [];

    // Add transportation events
    if (trip.transportation) {
        for (const transport of trip.transportation) {
            const departureDate = toDate(transport.departureTime);
            const arrivalDate = toDate(transport.arrivalTime);

            const typeEmoji = {
                flight: '✈️',
                train: '🚄',
                bus: '🚌',
                other: '🚗',
            };

            urls.push({
                title: `${typeEmoji[transport.type] || '🚗'} ${transport.flightNumber || transport.airline}`,
                url: generateGoogleCalendarUrl({
                    title: `${transport.flightNumber || transport.airline} - ${transport.departureAirportCode} to ${transport.arrivalAirportCode}`,
                    description: `Carrier: ${transport.airline}\nBooking: ${transport.bookingReference || 'N/A'}`,
                    location: transport.departureAirport,
                    startDate: departureDate,
                    endDate: arrivalDate,
                }),
                type: 'transport',
            });
        }
    }

    // Add activity events
    if (trip.days) {
        for (const day of trip.days) {
            const dayDate = toDate(day.date);

            if (day.activities) {
                for (const activity of day.activities) {
                    const startTime = parseTime(activity.startTime);
                    const endTime = parseTime(activity.endTime);

                    const startDate = new Date(dayDate);
                    startDate.setHours(startTime.hours, startTime.minutes, 0, 0);

                    let endDate = new Date(dayDate);
                    endDate.setHours(endTime.hours, endTime.minutes, 0, 0);

                    if (endDate <= startDate) {
                        endDate = addHours(startDate, 2);
                    }

                    urls.push({
                        title: `🎯 ${activity.name}`,
                        url: generateGoogleCalendarUrl({
                            title: activity.name,
                            description: activity.description || activity.notes || '',
                            location: activity.location?.name || activity.location?.address,
                            startDate,
                            endDate,
                        }),
                        type: 'activity',
                    });
                }
            }
        }
    }

    return urls;
};

// Download ICS file
export const downloadICSFile = (icsContent: string, filename: string): void => {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};
