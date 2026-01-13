# Troubleshooting Guide

## Build Errors

### better-sqlite3 Compilation Errors (Node.js 24+)

**Error**: `better-sqlite3` fails to compile with Node.js 24+

**Solution**: 
1. Update `better-sqlite3` to version 11.7.0 or later in `extension/package.json`
2. Ensure TypeScript types are installed: `@types/better-sqlite3`
3. Enable `esModuleInterop` in `extension/tsconfig.json`

```bash
cd extension
npm install better-sqlite3@^11.7.0
npm install --save-dev @types/better-sqlite3
```

Then update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### TypeScript Module Import Errors

**Error**: `Module can only be default-imported using the 'esModuleInterop' flag`

**Solution**: Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Native Module Build Failures

**Error**: `gyp ERR! build error` or `make failed`

**Solutions**:
1. Ensure build tools are installed:
   - Linux: `sudo apt-get install build-essential` (Debian/Ubuntu)
   - macOS: Install Xcode Command Line Tools
   - Windows: Install Visual Studio Build Tools

2. Clear cache and rebuild:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. For `better-sqlite3` specifically, try:
   ```bash
   npm install better-sqlite3 --build-from-source
   ```

## Runtime Errors

### Extension Can't Find state.vscdb

**Error**: `state.vscdb not found`

**Solutions**:
1. Ensure Cursor is installed and has been run at least once
2. Check the path in `extension/src/sync/dbReader.ts`
3. Verify file exists:
   - Linux: `~/.config/Cursor/User/globalStorage/state.vscdb`
   - macOS: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
   - Windows: `%APPDATA%\Cursor\User\globalStorage\state.vscdb`

### Database Lock Errors

**Error**: `database is locked`

**Solutions**:
1. Close Cursor/VS Code before syncing
2. Ensure only one process accesses the database
3. Use readonly mode when possible (already implemented in `dbReader.ts`)

### Authentication Errors

**Error**: `Invalid token` or `401 Unauthorized`

**Solutions**:
1. Re-login using the extension command
2. Check backend JWT_SECRET matches
3. Verify token hasn't expired
4. Clear extension storage and re-authenticate

## Backend Errors

### Database Connection Errors

**Error**: `Connection refused` or `ECONNREFUSED`

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   # Linux/macOS
   sudo systemctl status postgresql
   # or
   pg_isready
   ```

2. Check connection settings in `backend/.env`

3. Verify database exists:
   ```bash
   psql -U postgres -l | grep cursor_chat_sync
   ```

### Migration Errors

**Error**: Migration fails or tables already exist

**Solutions**:
1. Check if migrations have already run:
   ```bash
   psql -U postgres -d cursor_chat_sync -c "\dt"
   ```

2. Manually run migrations:
   ```bash
   cd backend
   npm run migrate
   ```

3. Reset database (WARNING: deletes all data):
   ```bash
   dropdb cursor_chat_sync
   createdb cursor_chat_sync
   npm run migrate
   ```

## Admin UI Errors

### API Connection Errors

**Error**: `Network Error` or `CORS error`

**Solutions**:
1. Verify backend is running on correct port
2. Check `admin-ui/.env` has correct `VITE_API_URL`
3. Ensure CORS is enabled in backend (already configured)
4. Check browser console for detailed error

### Build Errors

**Error**: Vite build fails

**Solutions**:
1. Clear cache:
   ```bash
   cd admin-ui
   rm -rf node_modules dist
   npm install
   npm run build
   ```

2. Check Node.js version (should be 20+)

3. Verify all dependencies are installed

## Docker Errors

### Container Won't Start

**Error**: Container exits immediately

**Solutions**:
1. Check logs:
   ```bash
   docker compose logs backend
   docker compose logs admin-ui
   ```

2. Verify environment variables in `docker-compose.yml`

3. Check database connection from container:
   ```bash
   docker compose exec backend npm run migrate
   ```

### Port Already in Use

**Error**: `port is already allocated`

**Solutions**:
1. Change ports in `docker-compose.yml`
2. Stop conflicting services
3. Find and kill process using port:
   ```bash
   # Linux/macOS
   lsof -i :3000
   kill -9 <PID>
   ```

## General Issues

### Node.js Version Mismatch

**Error**: Various compatibility errors

**Solution**: Use Node.js 20.x (LTS) for best compatibility:
```bash
# Using nvm
nvm install 20
nvm use 20
```

### Permission Denied Errors

**Error**: `EACCES` or permission denied

**Solutions**:
1. Don't use `sudo` with npm (fixes permissions instead)
2. Fix npm permissions:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   ```

3. For file system permissions, check file/directory ownership

### Memory Issues

**Error**: `JavaScript heap out of memory`

**Solutions**:
1. Increase Node.js memory:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. Or run with increased memory:
   ```bash
   node --max-old-space-size=4096 node_modules/.bin/tsc
   ```

## Getting Help

If you encounter issues not covered here:

1. Check the [Implementation Plan](IMPLEMENTATION_PLAN.md) for known issues
2. Review [Build Scripts Documentation](BUILD_SCRIPTS.md)
3. Check GitHub Issues (if repository is public)
4. Review logs:
   - Extension: VS Code Output panel → "Cursor Chat Sync"
   - Backend: Check console output or logs
   - Admin UI: Browser developer console

## Common Fixes Summary

```bash
# Complete clean rebuild
cd /path/to/CursorChatSync
rm -rf */node_modules */package-lock.json
npm run install:all
npm run build:all

# Reset database
cd backend
dropdb cursor_chat_sync && createdb cursor_chat_sync
npm run migrate

# Restart Docker services
docker compose down
docker compose up -d
```
