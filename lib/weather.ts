export interface WeatherData {
    temp: number;
    condition: string;
    icon: string;
    date: string;
}

export async function fetchWeatherForDestination(destination: string, dates: string[]): Promise<Record<string, WeatherData>> {
    try {
        // Use wttr.in for a free, keyless weather service
        // format=j1 provides a detailed JSON response
        const response = await fetch(`https://wttr.in/${encodeURIComponent(destination)}?format=j1`);
        if (!response.ok) throw new Error('Weather service unavailable');

        const data = await response.json();
        const weatherMap: Record<string, WeatherData> = {};

        interface WttrDay {
            date: string;
            hourly: Array<{
                time: string;
                tempC: string;
                weatherDesc: Array<{ value: string }>;
            }>;
        }

        // data.weather contains daily forecasts
        (data.weather as WttrDay[]).forEach((day) => {
            const date = day.date; // YYYY-MM-DD
            if (dates.includes(date)) {
                // Get noon weather if possible, otherwise first hour
                const noonWeather = day.hourly.find((h) => h.time === "1200") || day.hourly[0];

                weatherMap[date] = {
                    temp: parseInt(noonWeather.tempC),
                    condition: noonWeather.weatherDesc[0].value,
                    icon: mapConditionToIcon(noonWeather.weatherDesc[0].value.toLowerCase()),
                    date: date
                };
            }
        });

        return weatherMap;
    } catch (error) {
        console.warn('Weather service unavailable:', error instanceof Error ? error.message : 'Unknown error');
        return {};
    }
}

function mapConditionToIcon(condition: string): string {
    if (condition.includes('sun') || condition.includes('clear')) return 'sunny';
    if (condition.includes('rain') || condition.includes('shower') || condition.includes('drizzle')) return 'rainy';
    if (condition.includes('cloud') || condition.includes('overcast') || condition.includes('mist')) return 'cloudy';
    if (condition.includes('snow') || condition.includes('ice') || condition.includes('sleet')) return 'snowy';
    if (condition.includes('thunder')) return 'thunderstorm';
    return 'cloudy';
}
