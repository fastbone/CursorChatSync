# Chat Data Structure Documentation

## Overview

This document describes the **actual** structure of Cursor chat data stored in `state.vscdb`, based on research and reverse engineering.

**⚠️ IMPORTANT**: This is based on research findings. See `CURSOR_CHAT_STRUCTURE_RESEARCH.md` for detailed research notes.

## Database Structure

Cursor stores chat data in SQLite database files in **three locations**:

1. **Global Storage**: `~/.config/Cursor/User/globalStorage/state.vscdb` (Linux)
   - User-wide, shared across all workspaces

2. **Workspace Storage**: `~/.config/Cursor/User/workspaceStorage/<workspace-id>/state.vscdb` (Linux)
   - Workspace-specific, tied to workspace ID

3. **Workspace .cursor Directory**: `<workspace-root>/.cursor/state.vscdb` ⭐
   - Workspace-specific, tied to absolute project path
   - **Most important for workspace-specific chats**

- **Table**: `ItemTable` (key-value store)
- **Key Patterns**:
  - `composerData:<composerId>` - Conversation metadata
  - `bubbleId:<composerId>:<bubbleId>` - Individual messages
  - `composer.composerData` - Workspace chat list
  - `workbench.panel.aichat.view.aichat.chatdata` - Legacy chat data

## Data Formats

Chat data can appear in multiple formats:

### 1. Array Format
```json
[
  {
    "id": "conv-123",
    "messages": [...],
    "timestamp": "2024-01-01T00:00:00Z"
  },
  {
    "id": "conv-456",
    "messages": [...]
  }
]
```

### 2. Object with Conversations Array
```json
{
  "conversations": [
    {
      "conversationId": "conv-123",
      "messages": [...]
    }
  ]
}
```

### 3. Single Conversation Object
```json
{
  "id": "conv-123",
  "messages": [...],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 4. Nested Structure
```json
{
  "workspace1": {
    "conversations": [...]
  },
  "workspace2": {
    "conversations": [...]
  }
}
```

## Conversation Object Fields

### ID Fields (at least one expected)
- `composerId` - **Cursor's primary conversation ID**
- `id` - Generic ID field
- `conversationId` - Alternative ID field
- `chatId` - Chat-specific ID
- `uuid` - UUID identifier
- `conversation_id` - Snake case variant
- `chat_id` - Snake case variant

### Message Fields
- `messages` (array)
- `message` (array)
- `chat` (array)
- `content` (array)
- `items` (array)

### Timestamp Fields
- `timestamp`
- `createdAt`
- `updatedAt`
- `date`
- `time`
- `lastModified`
- `created_at`
- `updated_at`

## Validation

The system validates chat data using heuristics:

1. **Type Check**: Must be an object (not null, undefined, or primitive)
2. **Format Detection**: Identifies array, object, or nested structure
3. **Conversation Counting**: Attempts to count conversations
4. **Structure Validation**: Checks for ID and message fields
5. **Size Check**: Warns if data exceeds 10MB

## Fallback Mechanisms

When conversation IDs cannot be found:
- Generate hash-based ID from content
- Use index as fallback
- Preserve original structure when possible

## Notes

- The exact structure may vary between Cursor versions
- Validation uses flexible heuristics to accommodate variations
- Warnings are logged but don't prevent processing
- Errors prevent data from being stored

## Implementation Files

- `extension/src/utils/chatDataValidator.ts` - Extension validation
- `backend/src/utils/chatDataValidator.ts` - Backend validation
- `extension/src/utils/conversationIdExtractor.ts` - ID extraction
- `backend/src/utils/conversationIdExtractor.ts` - Backend ID extraction
