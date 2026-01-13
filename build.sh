#!/bin/bash

# Cursor Chat Sync - Build Script
# This script builds all components of the system

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"
print_status "Starting build process..."

# Parse command line arguments
BUILD_BACKEND=true
BUILD_ADMIN=true
BUILD_EXTENSION=true
INSTALL_DEPS=false
CLEAN_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            BUILD_ADMIN=false
            BUILD_EXTENSION=false
            shift
            ;;
        --admin-only)
            BUILD_BACKEND=false
            BUILD_EXTENSION=false
            shift
            ;;
        --extension-only)
            BUILD_BACKEND=false
            BUILD_ADMIN=false
            shift
            ;;
        --install)
            INSTALL_DEPS=true
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: ./build.sh [options]"
            echo ""
            echo "Options:"
            echo "  --backend-only    Build only the backend"
            echo "  --admin-only     Build only the admin UI"
            echo "  --extension-only Build only the extension"
            echo "  --install        Install dependencies before building"
            echo "  --clean          Clean build (remove node_modules and dist)"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    print_status "Cleaning build artifacts..."
    if [ "$BUILD_BACKEND" = true ]; then
        print_status "Cleaning backend..."
        cd backend && rm -rf dist node_modules && cd ..
    fi
    if [ "$BUILD_ADMIN" = true ]; then
        print_status "Cleaning admin UI..."
        cd admin-ui && rm -rf dist node_modules && cd ..
    fi
    if [ "$BUILD_EXTENSION" = true ]; then
        print_status "Cleaning extension..."
        cd extension && rm -rf out node_modules && cd ..
    fi
fi

# Install dependencies if requested
if [ "$INSTALL_DEPS" = true ]; then
    print_status "Installing dependencies..."
    if [ "$BUILD_BACKEND" = true ]; then
        print_status "Installing backend dependencies..."
        cd backend
        if [ ! -d "node_modules" ]; then
            npm install
        else
            print_warning "Backend node_modules exists, skipping install. Use --clean to force reinstall."
        fi
        cd ..
    fi
    
    if [ "$BUILD_ADMIN" = true ]; then
        print_status "Installing admin UI dependencies..."
        cd admin-ui
        if [ ! -d "node_modules" ]; then
            npm install
        else
            print_warning "Admin UI node_modules exists, skipping install. Use --clean to force reinstall."
        fi
        cd ..
    fi
    
    if [ "$BUILD_EXTENSION" = true ]; then
        print_status "Installing extension dependencies..."
        cd extension
        if [ ! -d "node_modules" ]; then
            npm install
        else
            print_warning "Extension node_modules exists, skipping install. Use --clean to force reinstall."
        fi
        cd ..
    fi
fi

# Build backend
if [ "$BUILD_BACKEND" = true ]; then
    print_status "Building backend..."
    cd backend
    if [ ! -d "node_modules" ]; then
        print_error "Backend dependencies not installed. Run with --install flag."
        exit 1
    fi
    npm run build
    if [ $? -eq 0 ]; then
        print_status "Backend build successful!"
    else
        print_error "Backend build failed!"
        exit 1
    fi
    cd ..
fi

# Build admin UI
if [ "$BUILD_ADMIN" = true ]; then
    print_status "Building admin UI..."
    cd admin-ui
    if [ ! -d "node_modules" ]; then
        print_error "Admin UI dependencies not installed. Run with --install flag."
        exit 1
    fi
    npm run build
    if [ $? -eq 0 ]; then
        print_status "Admin UI build successful!"
    else
        print_error "Admin UI build failed!"
        exit 1
    fi
    cd ..
fi

# Build extension
if [ "$BUILD_EXTENSION" = true ]; then
    print_status "Building extension..."
    cd extension
    if [ ! -d "node_modules" ]; then
        print_error "Extension dependencies not installed. Run with --install flag."
        exit 1
    fi
    npm run compile
    if [ $? -eq 0 ]; then
        print_status "Extension build successful!"
    else
        print_error "Extension build failed!"
        exit 1
    fi
    cd ..
fi

print_status "Build completed successfully!"
print_status "All requested components have been built."
