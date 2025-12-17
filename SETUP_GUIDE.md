# Waypool Setup Guide

## Quick Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd Waypool/backend
   ```

2. **Create `.env` file:**
   ```bash
   cat > .env << 'EOF'
   DATABASE_URL=postgresql://user:password@localhost:5432/waypool
   PORT=3000
   NODE_ENV=development
   EXPO_ACCESS_TOKEN=your_expo_access_token_here
   EOF
   ```

   **Or manually create `.env` with:**
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/waypool
   PORT=3000
   NODE_ENV=development
   EXPO_ACCESS_TOKEN=your_expo_access_token_here
   ```

3. **Update DATABASE_URL** with your actual PostgreSQL credentials

4. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

5. **Generate Prisma client:**
   ```bash
   npm run prisma:generate
   ```

6. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

7. **Start the server:**
   ```bash
   npm run dev
   ```

### Driver App Setup

1. **Navigate to driver-app directory:**
   ```bash
   cd Waypool/driver-app
   ```

2. **Create `.env` file:**
   ```bash
   cat > .env << 'EOF'
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
   EXPO_PUBLIC_API_URL_IOS=http://localhost:3000
   EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:3000
   EXPO_PUBLIC_API_URL_WEB=http://localhost:3000
   EOF
   ```

   **Or manually create `.env` with:**
   ```env
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
   EXPO_PUBLIC_API_URL_IOS=http://localhost:3000
   EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:3000
   EXPO_PUBLIC_API_URL_WEB=http://localhost:3000
   ```

3. **Get Google Places API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Places API"
   - Create credentials (API Key)
   - Copy the key and paste in `.env`

4. **For physical iOS devices:**
   - Find your computer's IP: `ipconfig getifaddr en0` (Mac) or `ifconfig` (Linux)
   - Update `config/api.ts` line 40 with your IP address
   - Or set `EXPO_PUBLIC_API_URL_IOS_PHYSICAL` in `.env` (if supported)

5. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

6. **Start Expo:**
   ```bash
   npm start
   ```

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/waypool` |
| `PORT` | No | Server port | `3000` |
| `NODE_ENV` | No | Environment mode | `development` |
| `EXPO_ACCESS_TOKEN` | No | Expo push notification token | `exp_xxxxx` |

### Driver App (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | ✅ Yes | Google Places API key | `AIzaSy...` |
| `EXPO_PUBLIC_API_URL_IOS` | No | iOS API URL | `http://localhost:3000` |
| `EXPO_PUBLIC_API_URL_ANDROID` | No | Android API URL | `http://10.0.2.2:3000` |
| `EXPO_PUBLIC_API_URL_WEB` | No | Web API URL | `http://localhost:3000` |

## Troubleshooting

### Backend won't start
- Check that `DATABASE_URL` is set correctly
- Verify PostgreSQL is running
- Check that Prisma client is generated: `npm run prisma:generate`

### Driver app can't connect to backend
- Verify backend is running on the correct port
- Check firewall settings
- For physical devices, ensure IP address is correct
- For iOS simulator, use `localhost`
- For Android emulator, use `10.0.2.2`

### Address autocomplete not working
- Verify `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is set
- Check Google Cloud Console that Places API is enabled
- Verify API key has correct restrictions/permissions

## Next Steps

1. ✅ Create `.env` files for both projects
2. ✅ Set up database and run migrations
3. ✅ Get Google Places API key
4. ✅ Test backend health endpoint: `http://localhost:3000/health`
5. ✅ Test driver app connection to backend
6. ✅ Verify address autocomplete works

