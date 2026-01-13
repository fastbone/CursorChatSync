# Implementation Plan - Remaining Features

## Overview

This plan outlines the remaining features and improvements needed to complete the Cursor Chat Sync system.

## Priority 1: Critical Missing Features

### 1. Complete Bidirectional Sync in Extension
**Status**: Partially implemented (only uploads, no download/merge)
**Files**: `extension/src/sync/syncManager.ts`, `extension/src/sync/dbWriter.ts`

**Tasks**:
- [ ] Store project_id mapping after upload (use workspace storage)
- [ ] Implement download after upload in sync flow
- [ ] Implement proper merge logic for chat history
- [ ] Handle conflicts (last-write-wins or merge strategy)
- [ ] Add endpoint to get project by repo URL (backend)

**Implementation Details**:
```typescript
// After upload, store project_id
const uploadResponse = await this.apiClient.uploadChat(...);
const projectId = uploadResponse.project_id; // Need to add this to response
await this.storeProjectMapping(gitRepoUrl, projectId);

// Download and merge
const remoteChat = await this.apiClient.downloadChat(projectId);
if (remoteChat) {
  const merged = this.dbWriter.mergeChatHistory(remoteChat.chat_data, localChatData);
  this.dbWriter.writeChatHistory(merged);
}
```

### 2. Return Project ID in Upload Response
**Status**: Missing
**Files**: `backend/src/routes/chat.ts`, `backend/src/services/chatService.ts`

**Tasks**:
- [ ] Modify upload response to include project_id
- [ ] Return full project info in response
- [ ] Update API client types

### 3. Add Project Lookup by Repo URL
**Status**: Missing
**Files**: `backend/src/routes/chat.ts`, `backend/src/services/projectService.ts`

**Tasks**:
- [ ] Add endpoint: `GET /api/chat/project?git_repo_url=...`
- [ ] Implement service method to find project by repo URL and user
- [ ] Use this in extension for downloads

### 4. Improve Chat Data Structure Handling
**Status**: Basic implementation, needs improvement
**Files**: `extension/src/sync/dbReader.ts`, `extension/src/sync/dbWriter.ts`

**Tasks**:
- [ ] Research actual Cursor chat data structure in state.vscdb
- [ ] Implement proper parsing of chat conversations
- [ ] Handle different chat formats (conversations, history, etc.)
- [ ] Add validation for chat data structure

## Priority 2: Important Enhancements

### 5. File Watching for Auto-Sync
**Status**: Missing
**Files**: `extension/src/sync/syncManager.ts`, `extension/src/extension.ts`

**Tasks**:
- [ ] Watch state.vscdb file for changes
- [ ] Trigger sync on file change (with debouncing)
- [ ] Handle file lock issues
- [ ] Add configuration for file watching

**Implementation**:
```typescript
// Watch state.vscdb for changes
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(/* path to state.vscdb */, 'state.vscdb')
);
watcher.onDidChange(() => {
  // Debounce and trigger sync
});
```

### 6. Project Mapping Storage
**Status**: Missing
**Files**: `extension/src/sync/syncManager.ts`, `extension/src/auth/authService.ts`

**Tasks**:
- [ ] Store git_repo_url -> project_id mapping in extension storage
- [ ] Load mapping on extension activation
- [ ] Update mapping after project creation
- [ ] Handle multiple projects per workspace

### 7. Better Error Handling and User Feedback
**Status**: Basic implementation
**Files**: All extension files

**Tasks**:
- [ ] Add retry logic for failed syncs
- [ ] Show detailed error messages
- [ ] Add sync status indicator in status bar
- [ ] Log sync operations for debugging
- [ ] Handle network errors gracefully

### 8. Conflict Resolution
**Status**: Basic merge, needs improvement
**Files**: `extension/src/sync/dbWriter.ts`

**Tasks**:
- [ ] Implement smarter merge algorithm
- [ ] Handle timestamp-based conflicts
- [ ] Add user preference for conflict resolution
- [ ] Preserve conversation context

## Priority 3: Backend Enhancements

### 9. Add Project Lookup Endpoint
**Status**: Missing
**Files**: `backend/src/routes/chat.ts`, `backend/src/services/projectService.ts`

**Tasks**:
- [ ] `GET /api/chat/project?git_repo_url=...&user_id=...`
- [ ] Return project with permission status
- [ ] Handle case where project doesn't exist

### 10. Improve Upload Response
**Status**: Missing project info
**Files**: `backend/src/routes/chat.ts`

**Tasks**:
- [ ] Include project_id in upload response
- [ ] Include project details
- [ ] Include permission status

### 11. Add Chat History Viewing in Admin UI
**Status**: Missing
**Files**: `admin-ui/src/components/ChatHistory/`

**Tasks**:
- [ ] Create ChatHistory component
- [ ] Add route for viewing chat history
- [ ] Display chat data in readable format
- [ ] Add filtering by project/user

### 12. Real-time Permission Updates
**Status**: Missing
**Files**: `admin-ui/src/components/Permissions/`

**Tasks**:
- [ ] Poll for permission status updates
- [ ] Show notifications for new requests
- [ ] Auto-refresh after approval/rejection

## Priority 4: UI/UX Improvements

### 13. Better Admin UI Error Handling
**Status**: Basic
**Files**: `admin-ui/src/components/**`

**Tasks**:
- [ ] Add loading states
- [ ] Show error toasts
- [ ] Add retry buttons
- [ ] Improve form validation

### 14. Extension Status Bar Integration
**Status**: Basic
**Files**: `extension/src/extension.ts`, `extension/src/sync/syncManager.ts`

**Tasks**:
- [ ] Persistent status bar item
- [ ] Show sync status (synced, syncing, error)
- [ ] Show last sync time
- [ ] Click to trigger sync

### 15. Extension Settings UI
**Status**: Missing
**Files**: `extension/src/commands/syncCommands.ts`

**Tasks**:
- [ ] Add settings command
- [ ] Show current configuration
- [ ] Allow changing API URL
- [ ] Test connection button

## Priority 5: Testing and Quality

### 16. Unit Tests
**Status**: Missing
**Files**: All

**Tasks**:
- [ ] Backend service tests
- [ ] Extension sync manager tests
- [ ] API client tests
- [ ] Database operation tests

### 17. Integration Tests
**Status**: Missing

**Tasks**:
- [ ] End-to-end sync flow
- [ ] Permission workflow
- [ ] Multi-user scenarios

### 18. Error Logging and Monitoring
**Status**: Missing

**Tasks**:
- [ ] Add structured logging
- [ ] Error tracking (Sentry or similar)
- [ ] Performance monitoring

## Implementation Order

### Phase 1: Complete Core Sync (Week 1)
1. Return project_id in upload response
2. Store project mapping in extension
3. Implement download and merge
4. Add project lookup endpoint

### Phase 2: Enhancements (Week 2)
5. File watching for auto-sync
6. Better error handling
7. Conflict resolution improvements
8. Status bar integration

### Phase 3: UI Improvements (Week 3)
9. Chat history viewing in admin UI
10. Real-time permission updates
11. Better error handling in admin UI
12. Extension settings UI

### Phase 4: Quality and Testing (Week 4)
13. Unit tests
14. Integration tests
15. Error logging
16. Documentation updates

## Notes

- All changes should maintain backward compatibility
- Database migrations may be needed for new features
- Consider performance impact of file watching
- Test with actual Cursor state.vscdb structure
- Document any assumptions about chat data format
