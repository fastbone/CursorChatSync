#!/bin/bash

# Cursor Chat Sync - Setup Script
# This script sets up the development environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed. Docker Compose setup will be skipped."
    DOCKER_AVAILABLE=false
else
    DOCKER_AVAILABLE=true
    print_status "Docker version: $(docker --version)"
fi

# Check for docker compose (newer) or docker-compose (older)
if [ "$DOCKER_AVAILABLE" = true ]; then
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        print_warning "docker compose is not available. Docker Compose setup will be skipped."
        DOCKER_AVAILABLE=false
    fi
fi

print_status "Prerequisites check passed!"

# Install dependencies
print_step "Installing dependencies..."

print_status "Installing backend dependencies..."
cd backend
if [ ! -f "package.json" ]; then
    print_error "backend/package.json not found!"
    exit 1
fi
npm install
cd ..

print_status "Installing admin UI dependencies..."
cd admin-ui
if [ ! -f "package.json" ]; then
    print_error "admin-ui/package.json not found!"
    exit 1
fi
npm install
cd ..

print_status "Installing extension dependencies..."
cd extension
if [ ! -f "package.json" ]; then
    print_error "extension/package.json not found!"
    exit 1
fi
npm install
cd ..

print_status "Dependencies installed successfully!"

# Setup environment files
print_step "Setting up environment files..."

if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        print_status "Creating backend/.env from .env.example..."
        cp backend/.env.example backend/.env
        print_warning "Please edit backend/.env with your configuration!"
    else
        print_warning "backend/.env.example not found. Please create backend/.env manually."
    fi
else
    print_status "backend/.env already exists, skipping..."
fi

if [ ! -f "admin-ui/.env" ]; then
    print_status "Creating admin-ui/.env..."
    echo "VITE_API_URL=http://localhost:3000/api" > admin-ui/.env
    print_status "Created admin-ui/.env"
else
    print_status "admin-ui/.env already exists, skipping..."
fi

# Database setup
print_step "Database setup..."

if [ "$DOCKER_AVAILABLE" = true ]; then
    read -p "Do you want to set up the database using Docker? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Starting Docker containers..."
        $DOCKER_COMPOSE_CMD up -d postgres
        
        print_status "Waiting for PostgreSQL to be ready..."
        sleep 5
        
        print_status "Running database migrations..."
        cd backend
        npm run migrate
        cd ..
        
        print_status "Database setup complete!"
    else
        print_warning "Skipping Docker database setup."
        print_warning "Please set up PostgreSQL manually and run: cd backend && npm run migrate"
    fi
else
    print_warning "Docker not available. Please set up PostgreSQL manually:"
    print_warning "1. Create database: createdb cursor_chat_sync"
    print_warning "2. Run migrations: cd backend && npm run migrate"
fi

# Build all components
print_step "Building all components..."

print_status "Building backend..."
cd backend
npm run build
cd ..

print_status "Building admin UI..."
cd admin-ui
npm run build
cd ..

print_status "Building extension..."
cd extension
npm run compile
cd ..

print_status "Build complete!"

# Summary
echo ""
print_status "========================================="
print_status "Setup completed successfully!"
print_status "========================================="
echo ""
print_status "Next steps:"
echo "  1. Edit backend/.env with your database credentials"
if [ "$DOCKER_AVAILABLE" = false ]; then
    echo "  2. Set up PostgreSQL database manually"
    echo "  3. Run: cd backend && npm run migrate"
fi
echo "  4. Start backend: cd backend && npm run dev"
echo "  5. Start admin UI: cd admin-ui && npm run dev"
echo "  6. Install extension in Cursor/VS Code"
echo ""
print_status "For Docker setup, run: docker compose up -d"
print_status "For more information, see README.md"
