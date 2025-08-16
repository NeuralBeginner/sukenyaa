#!/bin/bash

# SukeNyaa Stremio Addon - Android/Termux Installation Script
# This script sets up and runs the SukeNyaa addon on Android via Termux

set -e

echo "🎬 SukeNyaa Stremio Addon - Android Setup"
echo "========================================"
echo ""

# Check if we're in Termux
if [[ ! -d "/data/data/com.termux" ]]; then
    echo "⚠️  Warning: This script is designed for Termux on Android"
    echo "   You can still run it, but some features may not work as expected"
    echo ""
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please install Node.js first:"
    echo "   $ pkg install nodejs"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if ! dpkg --compare-versions "$NODE_VERSION" "ge" "$REQUIRED_VERSION"; then
    echo "❌ Node.js version $NODE_VERSION is too old"
    echo "   Required: $REQUIRED_VERSION or higher"
    echo "   Please update Node.js:"
    echo "   $ pkg update && pkg upgrade nodejs"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION found"

# Check if npm dependencies are installed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if project is built
if [[ ! -d "dist" ]]; then
    echo "🔨 Building project..."
    npm run build
fi

# Get local IP address
LOCAL_IP="127.0.0.1"
PORT="${PORT:-3000}"

echo ""
echo "🚀 Starting SukeNyaa addon server..."
echo "   Listening on: http://$LOCAL_IP:$PORT"
echo ""
echo "📱 To install in Stremio Android:"
echo "   1. Open Stremio app"
echo "   2. Go to Add-ons → Community Add-ons"
echo "   3. Enter URL: http://localhost:$PORT/manifest.json"
echo "   4. Click Install"
echo ""
echo "🧪 Test page available at: http://localhost:$PORT/test"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

# Start the server
npm start