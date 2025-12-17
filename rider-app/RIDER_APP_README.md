# Waypool Rider App

A modern React Native mobile application for riders using the Waypool ridesharing platform.

## Features

### 🎉 Welcome & Authentication
- **Welcome Screen**: Clean, simple onboarding with Waypool branding
- **Login**: Secure authentication with email and password
- **Signup**: Easy registration process for new riders
- **User Context**: Persistent authentication state using AsyncStorage

### 🏠 Home Screen
- Personalized greeting with user's name
- Quick "Book a ride" action button
- Recent rides history (coming soon)
- Saved places (Home & Work)

### 📊 Activity Screen
- User profile display with avatar
- Ride statistics (total rides and spending)
- Settings menu:
  - Edit profile
  - Payment methods
  - Ride history
  - Help & Support
- Logout functionality

## Tech Stack

- **React Native** (v0.81.5) with **Expo** (~54.0.25)
- **Expo Router** (~6.0.15) - File-based navigation
- **TypeScript** (~5.9.2)
- **React Navigation** - Tab navigation
- **AsyncStorage** - Persistent storage for user data
- **Expo Linear Gradient** - For gradient effects if needed

## Project Structure

```
rider-app/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigation layout
│   │   ├── index.tsx         # Home screen
│   │   └── explore.tsx       # Activity/Profile screen
│   ├── _layout.tsx           # Root layout with navigation
│   ├── welcome.tsx           # Welcome/Onboarding screen
│   ├── login.tsx             # Login screen
│   └── signup.tsx            # Signup screen
├── components/               # Reusable UI components
├── constants/
│   └── theme.ts             # Color and font definitions
├── context/
│   └── UserContext.tsx      # User authentication context
├── services/
│   └── api.ts               # API service for backend calls
├── config/
│   └── api.ts               # API configuration
├── assets/                  # Images and other assets
└── hooks/                   # Custom React hooks
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator

### Installation

1. Navigate to the rider-app directory:
```bash
cd rider-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Run on your preferred platform:
```bash
# For iOS
npm run ios

# For Android
npm run android

# For Web
npm run web
```

## Backend Integration

The app connects to the Waypool backend API. Make sure the backend server is running on:
- **iOS**: `http://localhost:3000`
- **Android**: `http://10.0.2.2:3000` (Android emulator's special alias)

API configuration can be found in `config/api.ts`.

## User Flow

1. **First Launch**: User sees the Welcome screen with options to Login or Signup
2. **Authentication**: User can either:
   - Login with existing credentials
   - Create a new account as a rider
3. **Home Screen**: After authentication, user is redirected to the Home tab
4. **Navigation**: User can switch between:
   - Home: Main dashboard with quick actions
   - Activity: Profile, stats, and settings

## Key Features Explained

### Welcome Screen
- Clean white background with Waypool logo
- Simple welcome message
- Two clear call-to-action buttons:
  - "Get Started" (black button) for new users
  - "Sign In" (outlined button) for returning users
- Minimalist, focused design

### Authentication
- Email validation
- Password requirements (minimum 6 characters)
- Error handling with user-friendly messages
- Role validation (ensures only riders can use this app)
- Persistent login state

### User Context
- Global state management for user data
- Automatic token storage
- Logout functionality
- Loading states

## Styling

The app uses a clean, minimalist design with:
- **Primary Color**: Black (#000000)
- **Background**: White (#FFFFFF)
- **Secondary Text**: Gray (#666666)
- **Input Background**: Light Gray (#F5F5F5)
- **Error Color**: System red (#FF3B30)
- **Typography**: System fonts with weights 400-700
- **Design Principles**:
  - Clean and minimal
  - High contrast for readability
  - Simple, focused user experience

## Future Enhancements

- [ ] Map integration for ride booking
- [ ] Real-time ride tracking
- [ ] In-app messaging with drivers
- [ ] Payment integration
- [ ] Rating and review system
- [ ] Push notifications
- [ ] Ride history with details
- [ ] Favorite destinations
- [ ] Promo codes and referrals

## Development

### Running Linter
```bash
npm run lint
```

### Building for Production

```bash
# For iOS
eas build --platform ios

# For Android
eas build --platform android
```

## Contributing

This is part of the Waypool project. Please follow the main project's contribution guidelines.

## License

Private - All rights reserved

