#!/bin/bash

# SukeNyaa Stremio Addon - Zero-Configuration Android/Termux Installation Script
# This script automatically sets up and runs the SukeNyaa addon with optimal configuration

set -e

echo "🎬 SukeNyaa Zero-Configuration Installation"
echo "==========================================="
echo "This script will automatically install and configure everything for you!"
echo ""

# Check if we're in Termux
TERMUX_DETECTED=false
if [[ -d "/data/data/com.termux" ]] || [[ "$PREFIX" == *"com.termux"* ]]; then
    TERMUX_DETECTED=true
    echo "✅ Termux environment detected"
else
    echo "⚠️  Warning: This script is optimized for Termux on Android"
    echo "   You can still run it, but some features may not work as expected"
fi
echo ""

# Function to install package if not present
install_if_missing() {
    local package=$1
    local command_check=$2
    local install_cmd=$3
    
    if ! command -v "$command_check" &> /dev/null; then
        echo "📦 Installing $package..."
        eval "$install_cmd"
        echo "✅ $package installed successfully"
    else
        echo "✅ $package is already installed"
    fi
}

# Auto-install dependencies if missing
echo "🔧 Checking and installing dependencies..."

if [[ "$TERMUX_DETECTED" == true ]]; then
    # Termux package installations
    install_if_missing "Node.js" "node" "pkg install -y nodejs"
    install_if_missing "Git" "git" "pkg install -y git"
    install_if_missing "Python" "python" "pkg install -y python"
    
    # Setup storage permissions (non-interactive)
    if [[ ! -d "$HOME/storage" ]]; then
        echo "📱 Setting up storage permissions..."
        termux-setup-storage
        echo "✅ Storage permissions configured"
    fi
else
    # Non-Termux installations (basic checks)
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed"
        echo "   Please install Node.js first and re-run this script"
        echo "   For Termux: pkg install nodejs"
        echo "   For Ubuntu/Debian: apt install nodejs npm"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo "❌ Git is not installed"
        echo "   Please install Git first and re-run this script"
        exit 1
    fi
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if ! dpkg --compare-versions "$NODE_VERSION" "ge" "$REQUIRED_VERSION" 2>/dev/null; then
    echo "❌ Node.js version $NODE_VERSION is too old"
    echo "   Required: $REQUIRED_VERSION or higher"
    if [[ "$TERMUX_DETECTED" == true ]]; then
        echo "   Updating Node.js..."
        pkg update && pkg upgrade nodejs
        NODE_VERSION=$(node --version | sed 's/v//')
        echo "✅ Node.js updated to $NODE_VERSION"
    else
        echo "   Please update Node.js and re-run this script"
        exit 1
    fi
else
    echo "✅ Node.js $NODE_VERSION is compatible"
fi

# Auto-install npm dependencies
echo ""
echo "📦 Installing project dependencies..."
if [[ ! -d "node_modules" ]] || [[ ! -f "package-lock.json" ]]; then
    echo "   Running npm install..."
    npm install
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies are already installed"
fi

# Auto-build project
echo ""
echo "🔨 Building project..."
if [[ ! -d "dist" ]] || [[ "src" -nt "dist" ]]; then
    echo "   Running npm run build..."
    npm run build
    echo "✅ Project built successfully"
else
    echo "✅ Project is already built"
fi

# Create .env file with optimal defaults if it doesn't exist
echo ""
echo "⚙️ Configuring optimal settings..."
if [[ ! -f ".env" ]]; then
    echo "   Creating optimized .env configuration..."
    cat > .env << EOF
# Optimized configuration for Android/Termux
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
CACHE_TTL=600
LOG_LEVEL=info
ENABLE_METRICS=true

# Mobile-optimized settings
SCRAPING_DELAY_MS=1500
MAX_CONCURRENT_REQUESTS=3
REQUEST_TIMEOUT_MS=15000

# Content filtering (safe defaults)
ENABLE_NSFW_FILTER=true
STRICT_MINOR_CONTENT_EXCLUSION=true

# Performance settings for mobile
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
CACHE_MAX_SIZE=500
EOF
    echo "✅ Optimal configuration created"
else
    echo "✅ Configuration file already exists"
fi

# Get network information
echo ""
echo "🌐 Network configuration..."
LOCAL_IP="127.0.0.1"
PORT="${PORT:-3000}"

# Try to detect actual network IP for helpful display
NETWORK_IP=""
if command -v ip &> /dev/null; then
    NETWORK_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7}' | head -1)
elif command -v ifconfig &> /dev/null; then
    NETWORK_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
fi

if [[ -n "$NETWORK_IP" ]]; then
    echo "📱 Local network IP detected: $NETWORK_IP"
    echo "   You can also use: http://$NETWORK_IP:$PORT/manifest.json"
fi

# Display final instructions
echo ""
echo "🚀 Starting SukeNyaa with zero-configuration setup..."
echo "   Server will start on: http://$LOCAL_IP:$PORT"
echo ""
echo "📱 TO INSTALL IN STREMIO ANDROID:"
echo "   1. Open Stremio app on your device"
echo "   2. Go to Add-ons → Community Add-ons"
echo "   3. Enter URL: http://localhost:$PORT/manifest.json"
echo "   4. Tap Install"
echo ""
echo "✅ EVERYTHING IS PRE-CONFIGURED:"
echo "   • All sources enabled (Anime, Movies, Other)"
echo "   • Quality and language filters optimized"
echo "   • Performance tuned for mobile"
echo "   • Safe content filtering enabled"
echo ""
echo "🔗 USEFUL LINKS (once server starts):"
echo "   • Welcome page: http://localhost:$PORT/welcome"
echo "   • Test page: http://localhost:$PORT/test"
echo "   • Configuration: http://localhost:$PORT/configure"
echo ""
echo "💡 TIP: Keep this terminal open while using Stremio"
echo "Press Ctrl+C to stop the server"
echo "==========================================="
echo ""

# Start the server with auto-setup
echo "Starting server with automatic configuration..."
npm start