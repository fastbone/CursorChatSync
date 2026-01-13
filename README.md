# Cursor Chat Sync

A comprehensive system for synchronizing Cursor chat history across multiple workstations with team collaboration features, authentication, and admin-controlled project sharing.

## Architecture

The system consists of three main components:

1. **Cursor Extension** - VS Code extension that reads/writes to `state.vscdb` and syncs with the backend
2. **Backend API** - Node.js/TypeScript REST API server with PostgreSQL database
3. **Admin UI** - React web interface for managing users, projects, and permissions

## Features

- ✅ Sync chat history across multiple workstations
- ✅ User authentication with JWT tokens
- ✅ Admin-controlled project sharing
- ✅ Automatic permission requests for cross-user sync
- ✅ Team management
- ✅ Hybrid sync (automatic + manual)
- ✅ Project-based chat history organization

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 15+ (if not using Docker)
- Cursor IDE installed

## Build Scripts

The project includes build scripts for easy setup and building:

### Quick Setup (Linux/macOS)
```bash
./setup.sh
```

### Quick Setup (Windows)
```cmd
setup.bat
```

### Build All Components (Linux/macOS)
```bash
./build.sh --install
```

### Build All Components (Windows)
```cmd
build.bat --install
```

### Build Options

- `--backend-only` - Build only the backend
- `--admin-only` - Build only the admin UI
- `--extension-only` - Build only the extension
- `--install` - Install dependencies before building
- `--clean` - Clean build (remove node_modules and dist)
- `--help` - Show help message

### Using npm Scripts

Alternatively, you can use npm scripts from the root directory:

```bash
# Install all dependencies
npm run install:all

# Build all components
npm run build:all

# Development (run backend and admin UI)
npm run dev:all

# Run database migrations
npm run migrate
```

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd CursorChatSync
```

2. Create environment file:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

3. Start all services:
```bash
docker-compose up -d
```

4. Run database migrations:
```bash
docker-compose exec backend npm run migrate
```

5. Access the services:
   - Backend API: http://localhost:3000
   - Admin UI: http://localhost:80
   - PostgreSQL: localhost:5432

### Manual Setup

#### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Set up PostgreSQL database:
```bash
createdb cursor_chat_sync
```

5. Run migrations:
```bash
npm run migrate
```

6. Start the server:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

#### Admin UI Setup

1. Navigate to admin-ui directory:
```bash
cd admin-ui
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional):
```bash
VITE_API_URL=http://localhost:3000/api
```

4. Start development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
npm run preview
```

#### Extension Setup

1. Navigate to extension directory:
```bash
cd extension
```

2. Install dependencies:
```bash
npm install
```

3. Compile TypeScript:
```bash
npm run compile
```

4. Install the extension:
   - Open Cursor/VS Code
   - Press `F5` to run the extension in development mode, or
   - Package the extension: `vsce package` (requires `vsce` tool)
   - Install the `.vsix` file in Cursor

## Configuration

### Backend Configuration

Edit `backend/.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cursor_chat_sync
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

### Extension Configuration

In Cursor/VS Code settings:
- `cursorChatSync.apiUrl`: Backend API URL (default: `http://localhost:3000/api`)
- `cursorChatSync.autoSyncInterval`: Auto-sync interval in milliseconds (default: 600000 = 10 minutes)
- `cursorChatSync.enableAutoSync`: Enable automatic syncing (default: true)

## Usage

### Initial Setup

1. **Create Admin User** (via API or directly in database):
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword",
    "name": "Admin User",
    "is_admin": true
  }'
```

2. **Login to Admin UI**:
   - Navigate to http://localhost:80
   - Login with admin credentials

3. **Create Users**:
   - Use the Admin UI to create users
   - Or use the API endpoints

### Using the Extension

1. **Login**:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run: `Cursor Chat Sync: Login to Chat Sync`
   - Enter your email and password

2. **Sync Chat History**:
   - Automatic: Extension syncs every 10 minutes (configurable)
   - Manual: Run `Cursor Chat Sync: Sync Chat History Now`

3. **Check Status**:
   - Run: `Cursor Chat Sync: Show Sync Status`

### Admin Workflow

1. **Assign Projects**:
   - Projects are automatically created when users sync
   - View all projects in the Admin UI

2. **Approve Permissions**:
   - When a user tries to sync another user's project, a permission request is created
   - Admins can approve/reject requests in the Permissions section

3. **Manage Teams**:
   - Create teams and assign members
   - Teams can be used for organizing users (future feature)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Chat
- `POST /api/chat/upload` - Upload chat history
- `GET /api/chat/download` - Download chat history
- `GET /api/chat/history` - Get chat history list

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id/admin` - Update admin status

### Permissions (Admin only)
- `GET /api/permissions` - List all permissions
- `GET /api/permissions/pending` - List pending permissions
- `POST /api/permissions/:id/approve` - Approve permission
- `POST /api/permissions/:id/reject` - Reject permission

### Teams (Admin only)
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create team
- `POST /api/teams/:id/members` - Add team member
- `DELETE /api/teams/:id/members/:userId` - Remove team member

## Database Schema

- **users**: User accounts with authentication
- **projects**: Git repositories/projects
- **chat_history**: Synced chat history data
- **permissions**: Cross-user sync permissions
- **teams**: Team organization
- **team_members**: Team membership

## Security Considerations

- Passwords are hashed using bcrypt
- JWT tokens with expiration
- Rate limiting on API endpoints
- Input validation using Zod
- SQL injection prevention (parameterized queries)
- HTTPS recommended for production

## Development

### Running Tests

```bash
# Backend tests (when implemented)
cd backend
npm test

# Frontend tests (when implemented)
cd admin-ui
npm test
```

### Database Migrations

```bash
cd backend
npm run migrate
```

### Building for Production

```bash
# Backend
cd backend
npm run build

# Admin UI
cd admin-ui
npm run build

# Extension
cd extension
npm run compile
```

## Troubleshooting

### Extension can't find state.vscdb

The extension looks for `state.vscdb` in the Cursor user data directory:
- Linux: `~/.config/Cursor/User/globalStorage/state.vscdb`
- macOS: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Windows: `%APPDATA%\Cursor\User\globalStorage\state.vscdb`

Make sure Cursor is installed and has been used at least once.

### Database Connection Issues

- Check PostgreSQL is running
- Verify database credentials in `.env`
- Ensure database exists: `createdb cursor_chat_sync`

### Permission Denied Errors

- Users can always sync their own projects
- Cross-user sync requires admin approval
- Check the Permissions section in Admin UI

## License

[Your License Here]

## Implementation Status

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for detailed information about:
- Remaining features to implement
- Partially implemented features
- Implementation priorities
- Development roadmap

### Current Status

**Completed:**
- ✅ Backend API with authentication
- ✅ Database schema and migrations
- ✅ Admin UI for user/project/permission management
- ✅ Extension structure and basic sync (upload only)
- ✅ Docker setup

**In Progress:**
- 🔄 Bidirectional sync (download and merge)
- 🔄 File watching for auto-sync
- 🔄 Project mapping storage

**Planned:**
- 📋 Conflict resolution improvements
- 📋 Chat history viewing in admin UI
- 📋 Real-time permission updates
- 📋 Extension status bar integration
- 📋 Unit and integration tests

## Contributing

[Contributing guidelines]
