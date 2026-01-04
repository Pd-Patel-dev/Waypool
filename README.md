# Waypool 🚗

Hey! This is Waypool - a ride-sharing app I've been working on as a side project. Think of it like a carpooling platform where drivers can post rides and riders can book seats. It's been a fun learning experience, especially getting real-time updates and payments working (that was... interesting 😅).

## What it does

Basically, drivers can create rides with their route, available seats, and price. Riders can browse available rides, book seats, and pay through the app. Everything updates in real-time so drivers and riders can see what's happening as it happens.

The app has three main parts:
- **Backend** - Node.js/Express API that handles everything
- **Driver App** - React Native app for drivers (Expo)
- **Rider App** - React Native app for riders (Expo)

## Tech Stack

I used:
- **Backend**: Node.js, Express, TypeScript, Prisma (PostgreSQL), Socket.io for real-time stuff
- **Mobile**: React Native with Expo (so much easier than dealing with native code directly)
- **Payments**: Stripe (their docs are actually pretty good)
- **Email**: Gmail API (this was a pain to set up but it works now)
- **Real-time**: Socket.io for live updates between driver and rider apps

## Getting Started

Okay so setting this up is a bit involved. You'll need:
- Node.js (I'm using v18+)
- PostgreSQL database
- Stripe account (for payments)
- Gmail API credentials (for email notifications)
- Expo CLI (for the mobile apps)

### Backend Setup

1. Go into the backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up your `.env` file. There's an `ENV_VARIABLES.md` file that explains all the variables you need. The main ones are:
   - Database URL (PostgreSQL)
   - JWT secret
   - Stripe keys
   - Gmail API credentials

4. Run migrations:
```bash
npm run prisma:migrate
```

5. Start the server:
```bash
npm run dev
```

The backend should be running on port 3000 (or whatever you set in your .env).

### Driver App Setup

1. Go into the driver-app folder:
```bash
cd driver-app
```

2. Install dependencies:
```bash
npm install
```

3. Make sure your backend API URL is set correctly in `config/api.ts`

4. Start the app:
```bash
npm start
```

Then scan the QR code with Expo Go or run it on a simulator/emulator.

### Rider App Setup

Same as driver app basically:

1. Go into the rider-app folder:
```bash
cd rider-app
```

2. Install dependencies:
```bash
npm install
```

3. Check the API URL in `config/api.ts`

4. Start it:
```bash
npm start
```

## Features (that actually work)

- ✅ User authentication (JWT tokens)
- ✅ Driver can create/edit rides
- ✅ Riders can browse and book rides
- ✅ Real-time location tracking
- ✅ Payment processing with Stripe
- ✅ Push notifications
- ✅ Email notifications (when rides are updated/started)
- ✅ WebSocket for real-time updates
- ✅ Driver payouts (weekly automated)
- ✅ Booking management (confirm, cancel, etc.)

## Things I learned (and struggled with)

- **WebSockets**: Getting Socket.io to work properly with authentication was tricky. Had to figure out how to pass tokens and handle reconnections.

- **Stripe**: Setting up Stripe Connect for driver payouts took way longer than I thought. The onboarding flow is complex but their API is solid once you get it.

- **Real-time updates**: Making sure drivers and riders see updates instantly was fun. Had to think about when to use WebSockets vs polling.

- **State management**: React Native state management can get messy. I ended up using Context API for most things, which works but could probably be better organized.

- **Email**: Gmail API OAuth2 setup is... not fun. But it works now so that's good.

## Project Structure

```
Waypool/
├── backend/          # Express API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   ├── middleware/ # Auth, validation, etc.
│   │   └── utils/    # Helper functions
│   ├── prisma/       # Database schema and migrations
│   └── scripts/      # Utility scripts
├── driver-app/       # Driver mobile app
│   ├── app/          # Screens (Expo Router)
│   ├── components/   # Reusable components
│   └── services/     # API calls, WebSocket, etc.
└── rider-app/        # Rider mobile app
    ├── app/          # Screens
    ├── components/   # Components
    └── services/     # API calls
```

## Database

I'm using Prisma as the ORM. The schema is in `backend/prisma/schema.prisma`. To see your data, you can run:
```bash
npm run prisma:studio
```

## Testing Payments

There's a `PAYMENT_TESTING_GUIDE.md` in the backend folder if you want to test the payment flow. Stripe has test cards you can use.

## Known Issues / Things to Fix

- The error handling could be better in some places
- Some API responses aren't super consistent (working on it)
- The UI could use some polish (I'm not a designer 😬)
- Need to add more input validation in some forms
- Email sending sometimes fails silently (need better error handling)

## Future Ideas

- Add reviews/ratings system
- Better map integration
- Chat between driver and riders
- Ride history analytics
- Better notification system

## Notes

This is a side project, so things might not be perfect. I've been learning as I go, so the code might have some rough edges. If you find bugs or have suggestions, feel free to let me know!

Also, make sure to set up all your environment variables properly. The backend won't start without the required ones, and the apps won't work without the API URL configured.

## License

Just a personal project, so no license really. Feel free to use it as reference or inspiration though!

---

Built with way too much coffee ☕ and Stack Overflow searches 🔍

