# Backup System Documentation

## Overview

The Cursor Chat Sync extension includes a comprehensive backup system that automatically creates backups before any write operation to prevent data loss. This ensures users can always restore their chat history if something goes wrong.

## Features

### Automatic Backups
- **Pre-write backups**: Automatically creates a backup before every sync operation
- **Configurable**: Can be enabled/disabled via `cursorChatSync.backupBeforeSync` setting
- **Atomic operations**: Uses atomic file operations to ensure backup integrity
- **Checksum verification**: Verifies backup integrity using SHA-256 checksums

### Backup Storage
- **Location**: `~/.cursor-chat-sync/backups/`
- **Format**: Each backup is stored in its own directory with:
  - `globalStorage.vscdb` - Global chat history backup
  - `workspaceStorage.vscdb` - Workspace storage backup (if available)
  - `workspaceCursor.vscdb` - Workspace .cursor directory backup (if available)
  - `metadata.json` - Backup metadata and checksums
  - `backup-info.json` - Backup information

### Backup Retention
- **Default**: Keeps last 10 backups
- **Configurable**: Set via `cursorChatSync.maxBackups` (1-100)
- **Automatic cleanup**: Old backups are automatically deleted when limit is reached
- **Manual deletion**: Users can manually delete specific backups

### Restore Functionality
- **Full restore**: Restores all backed up sources (global, workspace storage, .cursor)
- **Integrity verification**: Verifies backup before restore
- **Safety backup**: Creates a backup of current state before restoring (double safety)
- **Path handling**: Handles workspace path changes gracefully

## Usage

### Commands

1. **List Backups**: `Cursor Chat Sync: List Chat History Backups`
   - Shows all available backups with details
   - Allows selecting a backup to restore or delete

2. **Restore Backup**: `Cursor Chat Sync: Restore Chat History from Backup`
   - Restores chat history from a selected backup
   - Requires confirmation before restore

3. **Create Manual Backup**: `Cursor Chat Sync: Create Manual Backup`
   - Creates a backup on demand (useful before major operations)

4. **Delete Backup**: `Cursor Chat Sync: Delete Backup`
   - Deletes a specific backup to free up space

5. **Show Backup Info**: `Cursor Chat Sync: Show Backup Information`
   - Shows backup statistics (count, total size, location)

### Configuration

Add to your VS Code settings:

```json
{
  "cursorChatSync.backupBeforeSync": true,
  "cursorChatSync.maxBackups": 10
}
```

- `backupBeforeSync`: Enable/disable automatic backups before sync (default: `true`)
- `maxBackups`: Maximum number of backups to keep (default: `10`, range: 1-100)

## Backup Structure

Each backup directory contains:

```
backup-<timestamp>-<random>/
├── globalStorage.vscdb          # Global chat history
├── workspaceStorage.vscdb        # Workspace storage (if exists)
├── workspaceCursor.vscdb         # Workspace .cursor (if exists)
├── metadata.json                 # Backup metadata with checksums
└── backup-info.json              # Backup information
```

### metadata.json
```json
{
  "version": "1.0",
  "createdAt": "2024-01-13T10:00:00.000Z",
  "workspacePath": "/path/to/workspace",
  "sources": {
    "globalStorage": {
      "path": "...",
      "checksum": "sha256...",
      "size": 12345
    },
    "workspaceCursor": {
      "path": "...",
      "checksum": "sha256...",
      "size": 6789
    }
  }
}
```

### backup-info.json
```json
{
  "id": "backup-1234567890-abc123",
  "timestamp": "2024-01-13T10:00:00.000Z",
  "workspacePath": "/path/to/workspace",
  "globalStorageBackedUp": true,
  "workspaceStorageBackedUp": false,
  "workspaceCursorBackedUp": true,
  "backupPath": "/home/user/.cursor-chat-sync/backups/backup-...",
  "checksum": "sha256...",
  "size": 19134
}
```

## Safety Features

### Atomic Operations
- All file operations use atomic copy-then-rename pattern
- Prevents partial backups if operation is interrupted

### Integrity Verification
- SHA-256 checksums for all backup files
- Verification before restore
- Automatic detection of corrupted backups

### Pre-restore Backup
- Creates a backup of current state before restoring
- Allows recovery even if restore goes wrong

### Error Handling
- Continues with write even if backup fails (logs error)
- Clear error messages for users
- Graceful degradation

## Best Practices

1. **Keep backups enabled**: Always keep `backupBeforeSync` enabled (default)
2. **Regular cleanup**: Adjust `maxBackups` based on disk space
3. **Manual backups**: Create manual backups before major operations
4. **Verify backups**: Periodically verify backup integrity
5. **Monitor disk space**: Check backup directory size occasionally

## Troubleshooting

### Backup fails
- Check disk space: `~/.cursor-chat-sync/backups/`
- Check file permissions
- Check logs in extension output

### Restore fails
- Verify backup integrity first
- Check if workspace path has changed
- Ensure Cursor is closed during restore

### Disk space issues
- Reduce `maxBackups` setting
- Manually delete old backups
- Move backup directory to larger drive (advanced)

## Implementation Details

### BackupService Class
- Located in: `extension/src/sync/backupService.ts`
- Handles all backup/restore operations
- Integrated into `DbWriter` for automatic backups

### Integration Points
- `DbWriter.writeChatHistory()` - Creates backup before write
- `SyncManager.syncNow()` - Uses backup-enabled write
- Commands - User-facing backup management

## Security Considerations

- Backups contain sensitive chat data
- Stored in user's home directory (not shared)
- No encryption (local files only)
- Users should secure their home directory

## Future Enhancements

Potential improvements:
- Backup encryption
- Cloud backup integration
- Scheduled backups
- Backup compression
- Backup export/import
- Backup verification on schedule
