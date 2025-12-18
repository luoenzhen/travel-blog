import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: '--font-inter',
    display: 'swap',
});

const outfit = Outfit({
    subsets: ["latin"],
    variable: '--font-outfit',
    display: 'swap',
});

export const metadata: Metadata = {
    title: "TravelBlog - Share Your Adventures",
    description: "Document your travel experiences, share stories, and discover destinations through an engaging travel blog community.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "TravelBlog",
    },
    icons: {
        icon: "/icon-192x192.png",
        apple: "/icon-192x192.png",
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#0ea5e9" },
        { media: "(prefers-color-scheme: dark)", color: "#0c4a6e" }
    ],
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="apple-touch-icon" href="/icon-192x192.png" />
            </head>
            <body className={`${inter.className} antialiased min-h-screen`} suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
