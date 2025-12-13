# API Configuration Guide

## Backend Connection Setup

The driver-app is now connected to the backend API. You need to configure the API URL based on your development environment.

### Configuration File

Edit `config/api.ts` to set the correct API URL:

```typescript
// For Android Emulator
return "http://10.0.2.2:3000";

// For iOS Simulator
return "http://localhost:3000";

// For Physical Device (replace with your computer's IP)
return "http://192.168.1.100:3000";
```

### Finding Your Computer's IP Address

**Windows:**

```bash
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.100)
```

**Mac/Linux:**

```bash
ifconfig
# Look for inet address (e.g., 192.168.1.100)
```

### Testing the Connection

1. Make sure your backend is running:

   ```bash
   cd backend
   npm run dev
   ```

2. The backend should be running on `http://localhost:3000`

3. Test the signup endpoint from your app

### Troubleshooting

- **Connection refused**: Make sure backend is running
- **Network error**: Check your IP address and firewall settings
- **CORS errors**: The backend should allow requests from your app (already configured)

### Current API Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login (to be implemented)
