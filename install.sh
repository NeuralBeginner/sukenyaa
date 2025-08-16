#!/bin/bash

# SukeNyaa Zero-Configuration Installation Script
# Universal installer for all platforms: Desktop, Android/Termux, Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis for better UX
ROCKET="🚀"
CHECK="✅"
WARNING="⚠️"
ERROR="❌"
GEAR="⚙️"
PACKAGE="📦"
PHONE="📱"
COMPUTER="🖥️"
DOCKER="🐳"

echo -e "${CYAN}${ROCKET} SukeNyaa Zero-Configuration Universal Installer${NC}"
echo "============================================================"
echo -e "${BLUE}Automatic installation and configuration for all platforms${NC}"
echo ""

# Detect platform
detect_platform() {
    local platform="unknown"
    
    if [[ -d "/data/data/com.termux" ]] || [[ "$PREFIX" == *"com.termux"* ]]; then
        platform="termux"
    elif [[ -f "/.dockerenv" ]] || grep -q docker /proc/1/cgroup 2>/dev/null; then
        platform="docker"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        platform="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        platform="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        platform="windows"
    fi
    
    echo "$platform"
}

PLATFORM=$(detect_platform)

echo -e "${GEAR} Platform detected: ${GREEN}$PLATFORM${NC}"

case "$PLATFORM" in
    "termux")
        echo -e "${PHONE} Android/Termux installation mode"
        ;;
    "docker")
        echo -e "${DOCKER} Docker container mode"
        ;;
    "linux"|"macos")
        echo -e "${COMPUTER} Desktop/Server mode"
        ;;
    "windows")
        echo -e "${COMPUTER} Windows mode"
        ;;
    *)
        echo -e "${WARNING} Unknown platform - proceeding with generic installation"
        ;;
esac

echo ""

# Function to run command with error handling
run_command() {
    local description=$1
    local command=$2
    local required=${3:-true}
    
    echo -n "   $description... "
    
    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}${CHECK}${NC}"
        return 0
    else
        if [[ "$required" == "true" ]]; then
            echo -e "${RED}${ERROR}${NC}"
            echo -e "${RED}Failed to execute: $command${NC}"
            exit 1
        else
            echo -e "${YELLOW}${WARNING}${NC}"
            return 1
        fi
    fi
}

# Function to install package based on platform
install_package() {
    local package=$1
    local check_command=$2
    
    if command -v "$check_command" &> /dev/null; then
        echo -e "   ${package}: ${GREEN}${CHECK} Already installed${NC}"
        return 0
    fi
    
    echo -n "   Installing ${package}... "
    
    case "$PLATFORM" in
        "termux")
            if pkg install -y "$package" &>/dev/null; then
                echo -e "${GREEN}${CHECK}${NC}"
            else
                echo -e "${RED}${ERROR}${NC}"
                return 1
            fi
            ;;
        "linux")
            if command -v apt &> /dev/null; then
                sudo apt update &>/dev/null && sudo apt install -y "$package" &>/dev/null
            elif command -v yum &> /dev/null; then
                sudo yum install -y "$package" &>/dev/null
            elif command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm "$package" &>/dev/null
            else
                echo -e "${YELLOW}Please install $package manually${NC}"
                return 1
            fi
            echo -e "${GREEN}${CHECK}${NC}"
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install "$package" &>/dev/null
                echo -e "${GREEN}${CHECK}${NC}"
            else
                echo -e "${YELLOW}Please install $package manually or install Homebrew${NC}"
                return 1
            fi
            ;;
        "docker")
            echo -e "${BLUE}Assuming $package is available in container${NC}"
            ;;
        *)
            echo -e "${YELLOW}Please install $package manually${NC}"
            return 1
            ;;
    esac
}

# Install dependencies
echo -e "${PACKAGE} Installing dependencies..."

install_package "nodejs" "node"
install_package "npm" "npm"

if [[ "$PLATFORM" == "termux" ]]; then
    install_package "git" "git"
    install_package "python" "python"
    
    # Setup storage permissions for Termux
    if [[ ! -d "$HOME/storage" ]]; then
        echo -n "   Setting up storage permissions... "
        termux-setup-storage &>/dev/null && echo -e "${GREEN}${CHECK}${NC}" || echo -e "${YELLOW}${WARNING}${NC}"
    fi
fi

# Verify Node.js version
echo ""
echo -e "${GEAR} Verifying Node.js installation..."

NODE_VERSION=$(node --version | sed 's/v//' 2>/dev/null || echo "0.0.0")
REQUIRED_VERSION="16.0.0"

version_compare() {
    printf '%s\n%s\n' "$1" "$2" | sort -V -C
}

if version_compare "$REQUIRED_VERSION" "$NODE_VERSION"; then
    echo -e "   Node.js version: ${GREEN}v$NODE_VERSION ${CHECK}${NC}"
else
    echo -e "   ${ERROR} Node.js version v$NODE_VERSION is too old (required: v$REQUIRED_VERSION+)"
    
    if [[ "$PLATFORM" == "termux" ]]; then
        echo "   Attempting to update Node.js..."
        run_command "Updating Node.js" "pkg update && pkg upgrade nodejs"
        NODE_VERSION=$(node --version | sed 's/v//')
        echo -e "   Updated to: ${GREEN}v$NODE_VERSION${NC}"
    else
        echo "   Please update Node.js and re-run this script"
        exit 1
    fi
fi

# Install project dependencies
echo ""
echo -e "${PACKAGE} Installing project dependencies..."

if [[ ! -f "package.json" ]]; then
    echo -e "${ERROR} No package.json found. Are you in the SukeNyaa directory?"
    exit 1
fi

run_command "Installing npm packages" "npm install --production"

# Build project
echo ""
echo -e "${GEAR} Building project..."

run_command "Compiling TypeScript" "npm run build"

# Create optimized configuration
echo ""
echo -e "${GEAR} Creating optimized configuration..."

if [[ ! -f ".env" ]]; then
    echo -n "   Creating .env file... "
    
    # Platform-specific optimizations
    case "$PLATFORM" in
        "termux")
            cat > .env << 'EOF'
# Optimized for Android/Termux
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
CACHE_TTL=600
LOG_LEVEL=info
SCRAPING_DELAY_MS=1500
MAX_CONCURRENT_REQUESTS=2
REQUEST_TIMEOUT_MS=15000
CACHE_MAX_SIZE=300
RATE_LIMIT_MAX_REQUESTS=50
ENABLE_NSFW_FILTER=true
STRICT_MINOR_CONTENT_EXCLUSION=true
EOF
            ;;
        "docker")
            cat > .env << 'EOF'
# Optimized for Docker
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
CACHE_TTL=300
LOG_LEVEL=info
SCRAPING_DELAY_MS=1000
MAX_CONCURRENT_REQUESTS=5
REQUEST_TIMEOUT_MS=10000
CACHE_MAX_SIZE=1000
ENABLE_NSFW_FILTER=true
STRICT_MINOR_CONTENT_EXCLUSION=true
EOF
            ;;
        *)
            cat > .env << 'EOF'
# Optimized for Desktop
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
CACHE_TTL=300
LOG_LEVEL=info
SCRAPING_DELAY_MS=1000
MAX_CONCURRENT_REQUESTS=5
REQUEST_TIMEOUT_MS=10000
CACHE_MAX_SIZE=1000
ENABLE_NSFW_FILTER=true
STRICT_MINOR_CONTENT_EXCLUSION=true
EOF
            ;;
    esac
    
    echo -e "${GREEN}${CHECK}${NC}"
else
    echo -e "   Configuration file: ${GREEN}${CHECK} Already exists${NC}"
fi

# Network detection
echo ""
echo -e "${GEAR} Network configuration..."

PORT="${PORT:-3000}"
LOCAL_IP="127.0.0.1"

# Try to detect network IP
NETWORK_IP=""
if command -v ip &> /dev/null; then
    NETWORK_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7}' | head -1)
elif command -v ifconfig &> /dev/null; then
    NETWORK_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1 | cut -d: -f2)
fi

echo -e "   Server will run on: ${GREEN}http://$LOCAL_IP:$PORT${NC}"
if [[ -n "$NETWORK_IP" ]]; then
    echo -e "   Network access via: ${BLUE}http://$NETWORK_IP:$PORT${NC}"
fi

# Installation complete
echo ""
echo -e "${GREEN}${CHECK} Installation completed successfully!${NC}"
echo ""
echo "============================================================"
echo -e "${ROCKET} ${GREEN}SukeNyaa is ready for zero-configuration use!${NC}"
echo "============================================================"
echo ""

echo -e "${PHONE} ${YELLOW}TO INSTALL IN STREMIO:${NC}"
echo -e "   1. Open ${BLUE}Stremio${NC} → ${BLUE}Add-ons${NC} → ${BLUE}Community Add-ons${NC}"
echo -e "   2. Enter URL: ${GREEN}http://localhost:$PORT/manifest.json${NC}"
echo -e "   3. Click ${BLUE}Install${NC}"
echo ""

echo -e "${CHECK} ${GREEN}PRE-CONFIGURED FEATURES:${NC}"
echo -e "   • All sources enabled (Anime, Movies, Other)"
echo -e "   • Quality and language filters optimized"
echo -e "   • Performance tuned for your platform"
echo -e "   • Safe content filtering enabled"
echo -e "   • Smart caching and rate limiting"
echo ""

echo -e "${GEAR} ${CYAN}USEFUL LINKS (after starting):${NC}"
echo -e "   • Welcome page: ${BLUE}http://localhost:$PORT/welcome${NC}"
echo -e "   • Test page: ${BLUE}http://localhost:$PORT/test${NC}"
echo -e "   • Configuration: ${BLUE}http://localhost:$PORT/configure${NC}"
echo -e "   • Health check: ${BLUE}http://localhost:$PORT/api/health${NC}"
echo ""

echo -e "${YELLOW}To start SukeNyaa:${NC}"
case "$PLATFORM" in
    "termux")
        echo -e "   ${GREEN}./start-android.sh${NC}  (recommended for Android/Termux)"
        ;;
    *)
        echo -e "   ${GREEN}npm start${NC}  (start the server)"
        ;;
esac

echo -e "   ${GREEN}npm run dev${NC}  (development mode with auto-reload)"
echo ""
echo -e "${BLUE}Keep the terminal open while using Stremio with SukeNyaa!${NC}"
echo ""