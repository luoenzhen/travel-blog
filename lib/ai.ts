import { GoogleGenerativeAI } from "@google/generative-ai";
import { Trip, DayPlan, Activity } from "@/types";
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
                        "location": { "name": "Exact location name for map searching" },
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
