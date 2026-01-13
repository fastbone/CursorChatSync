# Cursor Chat Sync

A comprehensive system for synchronizing Cursor chat history across multiple workstations with team collaboration features, authentication, and admin-controlled project sharing.

## Architecture

The system consists of three main components:

1. **Cursor Extension** - VS Code extension that reads/writes to `state.vscdb` and syncs with the backend
2. **Backend API** - Node.js/TypeScript REST API server with PostgreSQL database
3. **Admin UI** - React web interface for managing users, projects, and permissions

## Features

### Core Functionality
- ✅ **Full bidirectional sync** - Upload, download, and intelligent merge of chat history
- ✅ **Automatic file watching** - Syncs when `state.vscdb` changes (with debouncing)
- ✅ **Smart conflict resolution** - Timestamp-based merging with deduplication
- ✅ **Project mapping persistence** - Remembers project associations across sessions

### User Experience
- ✅ **Status bar integration** - Real-time sync status with click-to-sync
- ✅ **Settings UI** - Easy configuration with connection testing
- ✅ **Retry logic** - Automatic retry (3 attempts) for network errors
- ✅ **Error handling** - Clear error messages and graceful failure handling

### Admin Features
- ✅ **Chat history viewer** - Browse and filter chat history by project/user
- ✅ **Real-time permission updates** - Auto-refresh with polling and notifications
- ✅ **Toast notifications** - User-friendly success/error feedback
- ✅ **Loading states** - Visual feedback during operations
- ✅ User authentication with JWT tokens
- ✅ Admin-controlled project sharing
- ✅ Automatic permission requests for cross-user sync
- ✅ Team management
- ✅ Project-based chat history organization

### Monitoring & Logging
- ✅ **Structured logging** - JSON-formatted logs with context
- ✅ **Error tracking** - Separate error logs for debugging
- ✅ **Request logging** - HTTP request/response logging with timing
- ✅ **Extension logging** - VS Code output channel and file logs
- ✅ **Log levels** - Configurable DEBUG, INFO, WARN, ERROR levels

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
- `--package-extension` - Package extension as .vsix file (requires extension to be built)
- `--install` - Install dependencies before building
- `--clean` - Clean build (remove node_modules and dist)
- `--help` - Show help message

**Example: Build and package extension**
```bash
./build.sh --extension-only --package-extension
```

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

3. (Optional) Create environment file for custom configuration:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration (optional - defaults work)
```

4. Start all services (PostgreSQL will be set up automatically):
```bash
docker compose up -d
```

The backend will automatically:
- Wait for PostgreSQL to be ready
- Run database migrations
- Start the server

5. Access the services:
   - Backend API: http://localhost:3000
   - Admin UI: http://localhost:80
   - PostgreSQL: localhost:5432

### Using Production Docker Images (GitHub Container Registry)

For production deployments, you can use pre-built Docker images from GitHub Container Registry:

1. **Authenticate with GitHub Container Registry:**
   ```bash
   # Using GitHub Personal Access Token (PAT)
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   
   # Or using password prompt
   docker login ghcr.io -u USERNAME
   ```
   
   Create a PAT with `read:packages` permission at: https://github.com/settings/tokens

2. **Download the production docker-compose file:**
   - Download `docker-compose.prod.yml` from the latest release
   - Or use the one in the repository (update image paths with your repository)

3. **Update image paths in docker-compose.prod.yml:**
   ```yaml
   # Replace OWNER/REPO with your GitHub repository
   # Example: ghcr.io/yourusername/cursorchatsync/backend:latest
   ```

4. **Create environment file:**
   ```bash
   # Create .env.prod with your configuration
   DB_NAME=cursor_chat_sync
   DB_USER=postgres
   DB_PASSWORD=your-secure-password
   JWT_SECRET=your-secret-key-change-in-production
   JWT_EXPIRES_IN=7d
   ```

5. **Start services:**
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

**Note:** Images are automatically built and pushed to GitHub Container Registry on each successful build to the main branch. Check the [Releases](https://github.com/YOUR_REPO/releases) page for the latest images.

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

4. **Install the extension** (choose one method):

   **Method A: Package as .vsix (Recommended for distribution)**
   ```bash
   # From extension directory
   npm run package
   
   # Or from project root
   ./build.sh --extension-only --package-extension
   ```
   
   Then install in Cursor/VS Code:
   ```bash
   # Using command line
   code --install-extension extension/cursor-chat-sync.vsix
   
   # Or manually:
   # 1. Open Cursor/VS Code
   # 2. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
   # 3. Click "..." menu → "Install from VSIX..."
   # 4. Select the cursor-chat-sync.vsix file
   ```

   **Method B: Development mode**
   - Open the project in Cursor/VS Code
   - Press `F5` to run the extension in development mode
   - This launches a new Extension Development Host window

5. **Configure the server address**:
   - After installation, open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run: `Cursor Chat Sync: Quick Setup: Configure Server`
   - Follow the setup wizard to configure your server URL
   - Or manually edit settings: `cursorChatSync.apiUrl`

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

**Easy Configuration (Recommended)**:
- Use the Quick Setup wizard: `Cursor Chat Sync: Quick Setup: Configure Server`
- This provides a guided setup with presets and connection testing

**Manual Configuration**:
In Cursor/VS Code settings (search for "cursorChatSync"):
- `cursorChatSync.apiUrl`: Backend API URL (default: `http://localhost:3000/api`)
  - Can be changed via Quick Setup wizard or Settings UI
  - Changes take effect immediately (no restart required)
- `cursorChatSync.autoSyncInterval`: Auto-sync interval in milliseconds (default: 600000 = 10 minutes)
- `cursorChatSync.enableAutoSync`: Enable automatic syncing (default: true)
- `cursorChatSync.enableFileWatching`: Enable file watching for auto-sync (default: true)
- `cursorChatSync.fileWatchDebounce`: Debounce delay in milliseconds (default: 5000 = 5 seconds)

## Usage

### Extension Usage

1. **Install the Extension**:
   - See [Extension Setup](#extension-setup) section above for detailed instructions
   - Quick method: `./build.sh --extension-only --package-extension` then install the `.vsix` file

2. **Quick Setup (First Time)**:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run: `Cursor Chat Sync: Quick Setup: Configure Server`
   - Follow the wizard to configure your server URL
   - The wizard includes connection testing

3. **Login**:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run: `Cursor Chat Sync: Login`
   - Enter your email and password

3. **Sync**:
   - **Automatic**: The extension will automatically sync when:
     - `state.vscdb` file changes (if file watching is enabled)
     - At configured intervals (if auto-sync is enabled)
   - **Manual**: Click the status bar item or run `Cursor Chat Sync: Sync Chat History Now`

4. **View Status**:
   - Check the status bar (bottom right) for sync status
   - Click it to trigger manual sync
   - Run `Cursor Chat Sync: Show Sync Status` for detailed info

5. **Configure**:
   - **Quick Setup**: Run `Cursor Chat Sync: Quick Setup: Configure Server` (recommended for first-time setup)
   - **Advanced Settings**: Run `Cursor Chat Sync: Open Chat Sync Settings`
   - **Manual**: Edit VS Code settings directly (search for "cursorChatSync")

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

### better-sqlite3 Build Errors with Node.js 24

If you encounter build errors when installing `better-sqlite3` with Node.js 24:

1. **Update better-sqlite3**: The extension uses `better-sqlite3 ^12.4.1` which supports Node.js 24
2. **Rebuild**: Run `npm rebuild better-sqlite3` in the extension directory
3. **Note**: VS Code/Cursor uses its own bundled Node.js version, so runtime compatibility is typically not an issue even if development builds fail
4. **Workaround**: Use Node.js 20 LTS for development if needed, or wait for better-sqlite3 updates

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

**Completed (Priority 1-4):**
- ✅ Backend API with authentication
- ✅ Database schema and migrations
- ✅ Admin UI for user/project/permission management
- ✅ **Full bidirectional sync** (upload, download, and merge)
- ✅ **File watching for auto-sync** with debouncing
- ✅ **Project mapping storage** (persistent git_repo_url → project_id)
- ✅ **Smart conflict resolution** with timestamp-based merging
- ✅ **Status bar integration** with real-time sync status
- ✅ **Extension settings UI** with connection testing
- ✅ **Chat history viewing** in Admin UI with filtering
- ✅ **Improved error handling** with retry logic and toast notifications
- ✅ **Better-sqlite3 v12.1.0** for Node.js v24 compatibility
- ✅ Docker setup

**Future Enhancements (Priority 5):**
- 📋 Unit and integration tests
- 📋 Real-time permission updates (polling)
- 📋 Error logging and monitoring (Sentry integration)
- 📋 Performance monitoring

## Contributing

[Contributing guidelines]
