#!/bin/bash

# Start Metro bundler in LAN mode for iPhone access
cd "$(dirname "$0")"

echo "🚀 Starting Metro bundler in LAN mode..."
echo "📱 This will make Metro accessible from your iPhone"
echo ""

# Kill any existing Metro processes
pkill -f "expo start" 2>/dev/null || true

# Clear cache
echo "🧹 Clearing cache..."
rm -rf .expo node_modules/.cache 2>/dev/null || true

# Start Metro with LAN mode
echo "🌐 Starting Metro on local network..."
npx expo start --lan --clear

