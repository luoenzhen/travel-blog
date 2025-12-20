import { Timestamp } from 'firebase/firestore';

// User Types
export interface User {
    id: string;
    email: string;
    displayName: string;
    photoURL?: string;
    bio?: string;
    website?: string;
    location?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // Statistics
    stats: {
        postsCount: number;
        followersCount: number;
        followingCount: number;
        tripsCount: number;
        countriesVisited: number;
    };

    // Preferences
    preferences: {
        theme: 'light' | 'dark' | 'system';
        notifications: boolean;
        emailNotifications: boolean;
        privacy: 'public' | 'private' | 'friends';
    };
}

// Post Types
export interface Post {
    id: string;
    authorId: string;
    author?: User; // Populated

    content: string;
    title?: string;

    // Media
    media: Media[];

    // Location
    location?: Location;

    // Categories and Tags
    categories: string[];
    tags: string[];

    // Engagement
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    bookmarksCount: number;

    // Publishing
    status: 'draft' | 'published' | 'scheduled';
    publishedAt?: Timestamp;
    scheduledFor?: Timestamp;

    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Media Types
export interface Media {
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    caption?: string;
    alt?: string;

    // Metadata
    size: number;
    mimeType: string;
    uploadedAt: Timestamp;

    // Location data (for photos)
    location?: {
        latitude: number;
        longitude: number;
        placeName?: string;
    };
}

// Location Types
export interface Location {
    id?: string;
    name: string;
    address?: string;
    city?: string;
    country?: string;
    countryCode?: string;

    // Coordinates
    latitude: number;
    longitude: number;

    // Additional info
    placeId?: string; // Google Places ID
    notes?: string;
}

// Comment Types
export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    author?: User; // Populated

    content: string;

    // Nested replies
    parentId?: string; // If this is a reply to another comment
    replies?: Comment[];

    // Engagement
    likesCount: number;

    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Trip Types
export interface Trip {
    id: string;
    userId: string;

    // Basic Info
    title: string;
    destination: string;
    coverPhoto?: string;

    // Dates
    startDate: Timestamp;
    endDate: Timestamp;

    // Day-by-day plans
    days: DayPlan[];

    // Budget
    budget: TripBudget;

    // Stays (Centralized accommodation management)
    stays?: AccommodationDetails[];
    transportation?: TransportationDetails[];

    // Collaboration
    collaborators: string[]; // User IDs
    isPublic: boolean;
    isLocked?: boolean;

    // Status
    status: 'draft' | 'active' | 'completed';

    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Day Plan Types
export interface DayPlan {
    id: string;
    tripId: string;
    date: Timestamp;
    dayNumber: number; // Day 1, Day 2, etc.

    // Flights
    transportation: TransportationDetails[];

    // Accommodation
    accommodation?: AccommodationDetails;
    accommodationCheckout?: AccommodationDetails; // Helper to show Checkout on the last day

    // Activities
    activities: Activity[];

    // Manual Reordering
    customOrder?: string[];

    // Dining
    dining: DiningPlan[];

    // Daily budget
    dailyBudget: number;
    actualSpent?: number;

    // Notes
    notes: string;

    // Photos from this day
    photos: Media[];

    // Completion status
    isCompleted: boolean;
}

// Transportation Details
export type TransportType = 'flight' | 'train' | 'bus' | 'other';

export interface TransportationDetails {
    id: string;
    type: TransportType;

    // Carrier info
    airline: string; // Used for airline name, train company, bus company
    flightNumber: string; // Used for flight no, train no, bus no

    // Departure
    departureAirport: string; // Used for airport/station name
    departureAirportCode: string; // Used for airport/station code
    departureTime: Timestamp;
    departureTerminal?: string; // Terminal or Platform

    // Arrival
    arrivalAirport: string;
    arrivalAirportCode: string;
    arrivalTime: Timestamp;
    arrivalTerminal?: string;

    // Booking
    bookingReference: string;
    cost: number;
    currency: string;

    // Additional info
    gate?: string;
    seat?: string;
    baggageAllowance?: string;
    notes?: string;
}

// Accommodation Details
export interface AccommodationDetails {
    id: string;

    // Property info
    name: string;
    type: 'hotel' | 'airbnb' | 'hostel' | 'resort' | 'other';
    address: string;
    location: Location;

    // Check-in/out
    checkInTime: string; // e.g., "3:00 PM"
    checkOutTime: string; // e.g., "11:00 AM"
    checkInDate?: string; // e.g. "2023-12-25"
    checkOutDate?: string; // e.g. "2023-12-28"

    // Room details
    roomType?: string;

    // Booking
    bookingConfirmation: string;
    cost: number;
    costPerNight: number;
    currency: string;

    // Contact
    phone?: string;
    email?: string;
    website?: string;

    // Amenities
    amenities: string[];

    // Notes
    notes?: string;

    // Customization
    color?: string;
    imageUrl?: string;
}

// Activity Types
export type ActivityType = 'sightseeing' | 'dining' | 'shopping' | 'transport' | 'entertainment' | 'other';

export interface Activity {
    id: string;
    type: ActivityType;

    // Activity info
    name: string;
    description?: string;

    // Time
    startTime: string; // e.g., "10:00 AM"
    endTime: string; // e.g., "12:00 PM"
    duration?: number; // in minutes

    // Location
    location: Location;

    // Cost
    cost: number;
    currency: string;

    // Booking
    bookingRequired: boolean;
    bookingConfirmation?: string;
    bookingUrl?: string;

    // Notes
    notes?: string;
    tips?: string;

    // Photos from this activity
    photos: Media[];

    // Lock status
    isLocked?: boolean;
    imageUrl?: string;
}

// Dining Plan
export interface DiningPlan {
    id: string;

    // Meal type
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';

    // Restaurant info
    restaurantName: string;
    cuisineType?: string;

    // Location
    location: Location;

    // Reservation
    hasReservation: boolean;
    reservationTime?: string;
    reservationName?: string;

    // Cost
    estimatedCost: number;
    actualCost?: number;
    currency: string;

    // Dietary notes
    dietaryNotes?: string;

    // Notes
    notes?: string;
}

// Trip Budget
export interface TripBudget {
    totalBudget: number;
    currency: string;

    // Category breakdown
    categories: {
        flights: number;
        accommodation: number;
        food: number;
        activities: number;
        shopping: number;
        transportation: number;
        other: number;
    };

    // Actual spending
    actualSpending: {
        flights: number;
        accommodation: number;
        food: number;
        activities: number;
        shopping: number;
        transportation: number;
        other: number;
    };

    // Daily limit
    dailyLimit?: number;
}

// Notification Types
export interface Notification {
    id: string;
    userId: string;

    type: 'like' | 'comment' | 'follow' | 'trip_reminder' | 'event_reminder';

    // Content
    title: string;
    message: string;

    // Related entities
    relatedPostId?: string;
    relatedUserId?: string;
    relatedTripId?: string;

    // Status
    isRead: boolean;

    // Timestamps
    createdAt: Timestamp;
}

// Trip Notification Settings
export interface TripNotificationSettings {
    tripId: string;
    enabled: boolean;

    // Notification types
    morningSummary: {
        enabled: boolean;
        time: string; // e.g., "07:00"
    };

    eventReminders: {
        flights: boolean;
        activities: boolean;
        dining: boolean;
        checkIn: boolean;
    };

    eveningPreview: {
        enabled: boolean;
        time: string; // e.g., "20:00"
    };

    // Timezone
    timezone: string;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
