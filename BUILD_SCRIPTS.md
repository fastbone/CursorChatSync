# Build Scripts Documentation

## Overview

This project includes comprehensive build scripts for easy setup, building, and development of all components.

## Available Scripts

### Setup Scripts

#### `setup.sh` (Linux/macOS)
Complete setup script that:
- Checks prerequisites (Node.js, npm, Docker)
- Installs all dependencies
- Creates environment files
- Sets up database (optional with Docker)
- Builds all components

**Usage:**
```bash
./setup.sh
```

#### `setup.bat` (Windows)
Windows equivalent of setup.sh

**Usage:**
```cmd
setup.bat
```

### Build Scripts

#### `build.sh` (Linux/macOS)
Builds all or selected components of the system.

**Usage:**
```bash
# Build all components (requires dependencies installed)
./build.sh

# Build with dependency installation
./build.sh --install

# Clean build (removes node_modules and dist)
./build.sh --clean --install

# Build only backend
./build.sh --backend-only --install

# Build only admin UI
./build.sh --admin-only --install

# Build only extension
./build.sh --extension-only --install

# Show help
./build.sh --help
```

#### `build.bat` (Windows)
Windows equivalent of build.sh

**Usage:**
```cmd
build.bat --install
build.bat --clean --install
build.bat --backend-only --install
```

### npm Scripts (Root Package)

From the root directory, you can use npm scripts:

```bash
# Install all dependencies
npm run install:all
npm run install:backend
npm run install:admin
npm run install:extension

# Build all components
npm run build:all
npm run build:backend
npm run build:admin
npm run build:extension

# Development
npm run dev:backend      # Start backend dev server
npm run dev:admin         # Start admin UI dev server
npm run dev:all          # Start both (requires concurrently)

# Testing
npm run test:backend
npm run test:admin
npm run test:all

# Linting
npm run lint:backend
npm run lint:admin
npm run lint:extension
npm run lint:all

# Cleaning
npm run clean:all
npm run clean:backend
npm run clean:admin
npm run clean:extension

# Database
npm run migrate           # Run database migrations

# Docker
npm run docker:build     # Build Docker images
npm run docker:up        # Start containers
npm run docker:down      # Stop containers
npm run docker:logs      # View logs
npm run docker:restart   # Restart containers

# Extension packaging
npm run package:extension  # Package extension as .vsix
```

## Build Process

### Backend Build
1. TypeScript compilation (`tsc`)
2. Output to `backend/dist/`
3. Source files in `backend/src/`

### Admin UI Build
1. Vite build process
2. TypeScript compilation
3. Output to `admin-ui/dist/`
4. Source files in `admin-ui/src/`

### Extension Build
1. TypeScript compilation (`tsc`)
2. Output to `extension/out/`
3. Source files in `extension/src/`
4. Package as `.vsix` for distribution

## Development Workflow

### Initial Setup
```bash
# Option 1: Use setup script
./setup.sh

# Option 2: Manual setup
npm run install:all
npm run migrate
npm run build:all
```

### Daily Development
```bash
# Start backend and admin UI in development mode
npm run dev:all

# Or separately:
npm run dev:backend  # Terminal 1
npm run dev:admin    # Terminal 2
```

### Building for Production
```bash
# Clean build
npm run clean:all
npm run build:all

# Or use build script
./build.sh --clean --install
```

### Extension Development
```bash
cd extension
npm install
npm run compile

# In VS Code/Cursor:
# Press F5 to run extension in development mode
```

## Docker Workflow

### Development with Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run migrations
docker-compose exec backend npm run migrate

# Stop services
docker-compose down
```

### Production Build
```bash
# Build images
docker-compose build

# Or use npm script
npm run docker:build
```

## Troubleshooting

### Build Fails
1. Check Node.js version: `node -v` (should be 20+)
2. Clean and rebuild: `./build.sh --clean --install`
3. Check for errors in component directories

### Dependencies Not Installing
1. Clear npm cache: `npm cache clean --force`
2. Remove node_modules: `npm run clean:all`
3. Reinstall: `npm run install:all`

### Extension Build Issues
1. Ensure VS Code API types are installed
2. Check `extension/tsconfig.json`
3. Verify `extension/package.json` has correct dependencies

### Docker Issues
1. Ensure Docker and Docker Compose are installed
2. Check Docker daemon is running
3. Verify `docker-compose.yml` syntax

## CI/CD Integration

The project includes a GitHub Actions workflow (`.github/workflows/build.yml`) that:
- Builds all components on push/PR
- Runs tests (if available)
- Builds Docker images

## Environment Variables

### Backend
Create `backend/.env` from `backend/.env.example`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cursor_chat_sync
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

### Admin UI
Create `admin-ui/.env`:
```env
VITE_API_URL=http://localhost:3000/api
```

## Next Steps

After building:
1. Set up database (see README.md)
2. Configure environment variables
3. Start services
4. Install extension in Cursor/VS Code

For implementation details, see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
