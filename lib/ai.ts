import { GoogleGenerativeAI } from "@google/generative-ai";
import { Trip, DayPlan, Activity, AccommodationDetails } from "@/types";
import { Timestamp } from "firebase/firestore";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function generateMagicItinerary(prompt: string, startDate: string, endDate: string, title?: string, destination?: string): Promise<Partial<Trip>> {
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add NEXT_PUBLIC_GEMINI_API_KEY to your env.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const systemPrompt = `You are a professional travel planner. Generate a detailed travel itinerary based on the user's request.
    ${title ? `User suggested title: ${title}` : ''}
    ${destination ? `Destination: ${destination}` : ''}
    
    The response MUST be a JSON object that fits the following structure:
    {
        "title": "A catchy title for the trip",
        "destination": "The primary city/region",
        "days": [
            {
                "dayNumber": 1,
                "date": "YYYY-MM-DD",
                "activities": [
                    {
                        "name": "Activity Name",
                        "type": "sightseeing | dining | shopping | transport | entertainment | other",
                        "startTime": "HH:mm AM/PM",
                        "endTime": "HH:mm AM/PM",
                        "location": { 
                            "name": "Venue Name, City, Country (full searchable address)",
                            "latitude": 0.0,
                            "longitude": 0.0
                        },
                        "notes": "Short description and why it fits the user interest",
                        "cost": 0,
                        "environment": "indoor | outdoor | both"
                    }
                ]
            }
        ]
    }
    
    Important rules:
    1. Only return the JSON object, no markdown, no explanations.
    2. Be specific with locations.
    3. Optimize timings for a realistic flow.
    4. Categorize environments correctly for weather adaptation.
    5. The trip starts on ${startDate} and ends on ${endDate}.
    6. ALWAYS use real-world, specific venue names and detailed addresses. FORBID generic placeholders like "City", "Local Restaurant", or "Nearby Park".
    7. Each location MUST include: [Venue Name], [District/Neighborhood if applicable], [City], [Country] (e.g., "The Louvre Museum, Rue de Rivoli, 75001 Paris, France").
    8. Every activity MUST have a non-empty "startTime" and "endTime" (e.g., "09:00 AM"). Ensure a logical progression throughout the day starting from around 9:00 AM.
    9. Respond in the same language as the user's request/prompt (e.g., if the user asks in Chinese, the "title", "destination", "notes", and "name" fields must be in Chinese).
    `;

    try {
        const result = await model.generateContent([systemPrompt, prompt]);
        const response = await result.response;
        const text = response.text();

        // Clean the response in case LLM adds markdown blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Failed to parse AI response");

        const data = JSON.parse(jsonMatch[0]);

        // Convert dates to Timestamps
        if (data.days) {
            data.days = data.days.map((day: any) => ({
                ...day,
                id: Math.random().toString(36).substring(2, 11),
                date: Timestamp.fromDate(new Date(day.date)),
                activities: day.activities.map((act: any) => {
                    const randomSalt = Math.floor(Math.random() * 1000);
                    const query = encodeURIComponent(`professional photography ${act.name} ${act.location?.name || ''} scenery`);
                    return {
                        ...act,
                        id: Math.random().toString(36).substring(2, 11),
                        currency: 'USD',
                        photos: [],
                        imageUrl: `https://www.bing.com/th?q=${query}&w=1200&h=600&c=4&rs=1&qlt=90&cdv=1&pid=16.1&r=${randomSalt}`
                    };
                })
            }));
        }

        return data;
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw error;
    }
}

export async function generateMagicDayActivities(
    destination: string,
    date: string,
    existingActivities: Activity[],
    accommodation?: AccommodationDetails,
    userPrompt: string = "",
    languageContext: string = ""
): Promise<Activity[]> {
    if (!apiKey) {
        throw new Error("Gemini API key is missing.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const existingContext = existingActivities.length > 0
        ? `STRICT GEOGRAPHIC BOUNDARY: The user is currently at or near: ${destination}. Existing activities for today are: ${existingActivities.map(a => `${a.name} at ${a.location?.name}`).join('; ')}. `
        : `STRICT GEOGRAPHIC BOUNDARY: The user is visiting: ${destination}. `;

    const systemPrompt = `You are a professional travel planner. Generate a list of 3-5 engaging activities for a single day.
    The date is ${date}.
    ${accommodation ? `The user is staying at: ${accommodation.name}, ${accommodation.location.name}. MANDATORY: All activities MUST be within walking distance or a short local commute from this specific address.` : ''}
    ${existingContext}
    
    CRITICAL RULES:
    1. STRICT LOCATION: You MUST only suggest activities in the EXACT same city and neighborhood as the boundary mentioned above. 
    2. NO TRAVELING: Do NOT suggest activities that involve traveling to other cities, even if they are in the same country. (e.g., if the user is in Paris, do NOT suggest something in Versailles or Lyon).
    3. If the user is at a specific venue, suggest things in the immediate vicinity.
    ${languageContext ? `CRITICAL LANGUAGE CONTEXT: The following text is in the user's preferred language: "${languageContext}".` : ''}
    
    The response MUST be a JSON array of activity objects:
    [
        {
            "name": "Activity Name",
            "type": "sightseeing | dining | shopping | transport | entertainment | other",
            "startTime": "HH:mm AM/PM",
            "endTime": "HH:mm AM/PM",
            "location": { 
                "name": "Venue Name, Address, City, Country",
                "latitude": 0.0,
                "longitude": 0.0
            },
            "notes": "Why this is a great choice",
            "cost": 0,
            "environment": "indoor | outdoor | both"
        }
    ]
    
    Rules:
    6. MANDATORY LANGUAGE RULE: You MUST detect the language used in the "CRITICAL LANGUAGE CONTEXT" above and respond in that EXACT SAME LANGUAGE for all text fields (specifically "name", "location.name", and "notes").
    7. ALL activities MUST be within the specific city/town of: ${destination}.
    `;

    try {
        const result = await model.generateContent([systemPrompt]);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("Failed to parse AI response");

        const activities = JSON.parse(jsonMatch[0]);

        return activities.map((act: any) => {
            const randomSalt = Math.floor(Math.random() * 1000);
            const query = encodeURIComponent(`professional photography ${act.name} ${act.location?.name || ''} scenery`);
            return {
                ...act,
                id: Math.random().toString(36).substring(2, 11),
                currency: 'USD',
                photos: [],
                imageUrl: `https://www.bing.com/th?q=${query}&w=1200&h=600&c=4&rs=1&qlt=90&cdv=1&pid=16.1&r=${randomSalt}`
            };
        });
    } catch (error) {
        console.error("Single Day AI Generation Error:", error);
        throw error;
    }
}

export async function geocodeLocations(locationNames: string[]): Promise<Record<string, { latitude: number, longitude: number }>> {
    if (!apiKey || locationNames.length === 0) return {};

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `Geocode the following location names. Return a JSON object mapping each name to its coordinates:
    ${JSON.stringify(locationNames)}
    
    Response format:
    {
        "Location Name": { "latitude": 0.0, "longitude": 0.0 }
    }
    
    Rules:
    1. Only return JSON.
    2. Be as accurate as possible.
    3. If a location is vague, provide coordinates for the center of its city.`;

    try {
        const result = await model.generateContent([prompt]);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return {};
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("Geocoding Error:", error);
        return {};
    }
}
