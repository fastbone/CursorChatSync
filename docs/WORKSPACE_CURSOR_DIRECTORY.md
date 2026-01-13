# Workspace .cursor Directory

## Overview

Cursor stores workspace-specific chat history in a `.cursor` directory at the root of each project workspace. This is a **critical location** for syncing workspace-specific conversations.

## Location

- **Path**: `<workspace-root>/.cursor/state.vscdb`
- **Scope**: Workspace-specific, tied to the **absolute path** of the project
- **Format**: SQLite database with `ItemTable` (key-value store)

## Importance

1. **Primary Workspace Storage**: This is where Cursor stores most workspace-specific chat conversations
2. **Path-Dependent**: The chat history is tied to the absolute path of the project
   - Moving or renaming the project folder can make chat history inaccessible
   - This is why syncing is important - it preserves chat history across moves
3. **Workspace Isolation**: Each workspace has its own `.cursor` directory
4. **User-Specific**: The `.cursor` directory is typically in the user's workspace, not shared

## Database Structure

Same as other Cursor databases:
- **Table**: `ItemTable`
- **Columns**: `key` (TEXT), `value` (TEXT/BLOB)
- **Key Patterns**: Same as global/workspace storage:
  - `composerData:<composerId>`
  - `bubbleId:<composerId>:<bubbleId>`
  - `composer.composerData`
  - `workbench.panel.aichat.view.aichat.chatdata`

## Reading Strategy

When reading chat history, the extension now reads from **all three locations**:

1. **Global Storage** (`~/.config/Cursor/User/globalStorage/state.vscdb`)
   - User-wide conversations
   - Shared across all workspaces

2. **Workspace Storage** (`~/.config/Cursor/User/workspaceStorage/<workspace-id>/state.vscdb`)
   - Workspace-specific (by workspace ID hash)
   - In user data directory

3. **Workspace .cursor Directory** (`<workspace-root>/.cursor/state.vscdb`) ⭐
   - Workspace-specific (by absolute path)
   - **Most important for workspace chats**
   - In project root

## Writing Strategy

When writing chat history:

- **Workspace-specific chats**: Write to workspace `.cursor` directory (if it exists or can be created)
- **Global chats**: Write to global storage
- **Fallback**: If workspace `.cursor` directory doesn't exist, write to global storage

## Implementation

The `DbReader` class now:
- Checks for workspace `.cursor` directory on initialization
- Reads from all three locations when `readChatHistory()` is called
- Merges data from all sources

The `DbWriter` class now:
- Prefers writing to workspace `.cursor` directory for workspace-specific chats
- Falls back to global storage if workspace directory doesn't exist
- Creates the `.cursor` directory if needed

## Migration Notes

If a user moves or renames their project:
- The old `.cursor` directory may become inaccessible
- Synced chat history can be restored from the backend
- The extension will create a new `.cursor` directory in the new location

## References

- [Cursor Chat History Management](https://www.cursor.fan/tutorial/HowTo/manage-cursor-chat-history/)
- [Chat History Inaccessible After Moving Project](https://forum.cursor.com/t/chat-history-inaccessible-after-renaming-or-moving-a-cursor-project-directory/143475)
