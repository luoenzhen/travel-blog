# TravelBlog PWA - Share Your Adventures 🌍

A comprehensive Progressive Web App for documenting travel experiences, planning trips, and discovering destinations. Built with Next.js 15, React, TypeScript, Firebase, and Tailwind CSS.

## ✨ Features

### Core Features (Phase 1)
- ✅ User authentication (Email & Google OAuth)
- ✅ Create, edit, and delete travel blog posts
- ✅ Photo and video uploads
- ✅ Home feed with infinite scroll
- ✅ Like and comment on posts
- ✅ User profiles with travel statistics
- ✅ Follow/unfollow users
- ✅ Search functionality

### Trip Planning Features
- 📅 Create detailed trip itineraries
- 🗓️ Day-by-day planning with:
  - ✈️ Flight details (times, airlines, booking refs)
  - 🏨 Accommodation tracking
  - 📍 Activity scheduling with time slots
  - 🍽️ Dining plans (breakfast, lunch, dinner)
  - 💰 Budget tracking per day and category
  - 📝 Notes and reminders
- 📸 Location-based photo documentation
- 🔔 Smart notifications for upcoming events
- 🗺️ Interactive maps and timeline
- 📄 Export trips to PDF

### PWA Capabilities
- 📱 Installable on mobile home screen
- 🔌 Offline functionality
- 🔔 Push notifications
- ⚡ Fast loading with caching
- 📱 Responsive mobile-first design

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ and npm
- Firebase account (free tier works)
- Google Maps API key (optional, for maps)

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd "d:\\projects\\test\\travel blog"
   ```

2. **Install dependencies** (already done)
   ```bash
   npm install
   ```

3. **Set up Firebase**
   
   a. Go to [Firebase Console](https://console.firebase.google.com)
   
   b. Create a new project (or use existing)
   
   c. Enable the following services:
      - **Authentication**: Enable Email/Password and Google providers
      - **Firestore Database**: Create in production mode, then set up security rules
      - **Storage**: Enable for media uploads
   
   d. Get your Firebase config:
      - Go to Project Settings → General
      - Scroll to "Your apps" → Web app
      - Copy the configuration

4. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔥 Firebase Setup Details

### Firestore Security Rules
Add these rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Posts collection
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId;
    }
    
    // Comments collection
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId;
    }
    
    // Trips collection
    match /trips/{tripId} {
      allow read: if resource.data.isPublic == true || 
                     (request.auth != null && 
                      (request.auth.uid == resource.data.userId || 
                       request.auth.uid in resource.data.collaborators));
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

### Storage Security Rules
Add these rules in Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /posts/{postId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /trips/{tripId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 📁 Project Structure

```
travel-blog-pwa/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout with fonts and metadata
│   ├── page.tsx             # Landing page
│   ├── globals.css          # Global styles
│   ├── auth/                # Authentication pages
│   ├── profile/             # User profile pages
│   ├── create/              # Post creation
│   ├── trips/               # Trip planning pages
│   └── explore/             # Discovery pages
├── components/              # React components
│   ├── layout/              # Layout components (Header, Nav)
│   ├── feed/                # Feed components (PostCard, etc.)
│   ├── trips/               # Trip planning components
│   ├── auth/                # Auth components
│   └── ui/                  # Reusable UI components
├── lib/                     # Utilities and services
│   ├── firebase/            # Firebase configuration and services
│   └── utils.ts             # Utility functions
├── store/                   # Zustand state management
│   ├── authStore.ts         # Authentication state
│   └── postStore.ts         # Posts state
├── types/                   # TypeScript type definitions
│   └── index.ts             # All type definitions
├── public/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   └── icons/               # App icons
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.ts       # Tailwind CSS config
└── next.config.ts           # Next.js config
```

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 📱 PWA Installation

### On Mobile (iOS/Android)
1. Open the app in your mobile browser
2. Tap the share button (iOS) or menu (Android)
3. Select "Add to Home Screen"
4. The app will install like a native app

### On Desktop (Chrome/Edge)
1. Look for the install icon in the address bar
2. Click "Install" when prompted
3. The app will open in its own window

## 🎨 Customization

### Colors
Edit `tailwind.config.ts` to customize the color palette:
- `primary`: Main brand color (currently blue)
- `accent`: Secondary color (currently purple)

### Fonts
The app uses:
- **Inter**: Body text
- **Outfit**: Headings and display text

Change fonts in `app/layout.tsx`.

## 🚢 Deployment

### Deploy to Vercel (Recommended)
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables
5. Deploy!

### Deploy to Netlify
1. Build the project: `npm run build`
2. Deploy the `out` folder to Netlify
3. Add environment variables in Netlify dashboard

## 📲 iOS Sideloading with AltStore

This app supports automated iOS `.ipa` generation via GitHub Actions, designed specifically for sideloading with **AltStore** (no paid Apple Developer account needed).

### Option 1: Direct IPA Sideloading with AltStore
1. Go to the GitHub repository: `https://github.com/luoenzhen/travel-blog/actions`
2. Download the `TravelBlog-IPA` artifact from the latest successful build (or from **Releases**).
3. On your iOS device (or computer with AltServer):
   - **AltStore on iOS**: Open AltStore -> **My Apps** -> tap **+** -> select `TravelBlog.ipa`.
   - **AltServer on PC/Mac**: Hold Option/Shift -> Click AltServer -> "Install IPA..." -> select `TravelBlog.ipa`.
4. AltStore signs the app using your free Apple ID and installs it!

### Option 2: Add AltStore Community Source Feed
You can add this repository as a custom Source in AltStore for automatic updates:
1. Open **AltStore** on your iOS device.
2. Go to the **Sources** tab and tap **+** (or Edit -> Add).
3. Enter the Source URL:
   ```text
   https://raw.githubusercontent.com/luoenzhen/travel-blog/master/altstore.json
   ```
4. Travel Blog will appear in your AltStore browser. Tap **FREE** / **INSTALL** to install and get updates with a single tap.


## 🔐 Environment Variables

Required variables:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional:
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (for Analytics)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (for maps)

## 📝 Next Steps

1. ✅ Set up Firebase project
2. ✅ Configure environment variables
3. ✅ Run development server
4. 🔄 Implement remaining features:
   - Post creation UI
   - Trip planner UI
   - Profile pages
   - Explore/Discovery
   - Notifications
5. 🧪 Test the app
6. 🚀 Deploy to production

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📄 License

MIT License - feel free to use this project as a template for your own travel blog!

## 🆘 Troubleshooting

### Firebase Connection Issues
- Verify all environment variables are set correctly
- Check Firebase project settings
- Ensure authentication providers are enabled

### Build Errors
- Delete `node_modules` and `.next` folders
- Run `npm install` again
- Clear npm cache: `npm cache clean --force`

### PWA Not Installing
- Ensure you're using HTTPS (required for PWA)
- Check that `manifest.json` is accessible
- Verify service worker is registered

## 📧 Support

For issues or questions, please check the documentation or create an issue in the repository.

---

**Happy Traveling! ✈️🌍📸**
