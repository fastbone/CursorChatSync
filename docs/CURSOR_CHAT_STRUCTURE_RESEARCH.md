# Cursor Chat Storage Structure - Research Findings

## Database Locations

Cursor stores chat history in **three** locations:

### 1. Global Storage (User-wide)
- **Path**: `~/.config/Cursor/User/globalStorage/state.vscdb` (Linux)
- **Path**: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` (macOS)
- **Path**: `%APPDATA%\Cursor\User\globalStorage\state.vscdb` (Windows)
- **Table**: `ItemTable` (key-value store)
- **Scope**: User-wide, shared across all workspaces

### 2. Workspace Storage (User Data Directory)
- **Path**: `~/.config/Cursor/User/workspaceStorage/<workspace-id>/state.vscdb` (Linux)
- **Path**: `~/Library/Application Support/Cursor/User/workspaceStorage/<workspace-id>/state.vscdb` (macOS)
- **Path**: `%APPDATA%\Cursor\User\workspaceStorage\<workspace-id>\state.vscdb` (Windows)
- **Table**: `ItemTable` (key-value store)
- **Scope**: Workspace-specific, tied to workspace ID (hash of workspace path)

### 3. Workspace .cursor Directory (Project Root) ⭐ IMPORTANT
- **Path**: `<workspace-root>/.cursor/state.vscdb`
- **Table**: `ItemTable` (key-value store)
- **Scope**: Workspace-specific, tied to **absolute path** of the project
- **Note**: This is the primary location for workspace-specific chat history
- **Important**: Moving or renaming the project folder can make this chat history inaccessible

## Key Patterns

### Global Storage Keys
1. **Composer Data**: `composerData:<composerId>`
   - Stores session metadata for each conversation
   
2. **Bubble Messages**: `bubbleId:<composerId>:<bubbleId>`
   - Stores individual messages within a conversation

### Workspace Storage Keys
1. **Primary Chat List**: `composer.composerData`
   - Contains the main chat list for the workspace
   
2. **Legacy Chat Data**: `workbench.panel.aichat.view.aichat.chatdata`
   - Stores legacy chat data format

## Data Structures

### ComposerData Structure
```json
{
  "_v": 3,
  "composerId": "12345",
  "createdAt": 1672531200000,
  "lastUpdatedAt": 1672617600000,
  "status": "completed"
}
```

**Fields**:
- `_v`: Version of the payload (integer)
- `composerId`: Unique identifier for the conversation (string)
- `createdAt`: Timestamp of creation in milliseconds (number)
- `lastUpdatedAt`: Timestamp of the last update in milliseconds (number)
- `status`: Status of the conversation - `"completed"` or `"aborted"` (string)

### Bubble Message Structure
```json
{
  "type": 1,
  "bubbleId": "67890",
  "text": "Hello, how can I assist you today?",
  "relevantFiles": ["file1.ts"],
  "suggestedCodeBlocks": [],
  "attachedFoldersNew": []
}
```

**Fields**:
- `type`: Message type (integer)
  - `1` = User message
  - `2` = Assistant response
- `bubbleId`: Unique identifier for the message (string)
- `text`: Content of the message (string)
- `relevantFiles`: Array of file paths related to the message (string[])
- `suggestedCodeBlocks`: Array of code blocks suggested in the message (array)
- `attachedFoldersNew`: List of folders attached to the message (array)

## Query Patterns

### To get all composer data:
```sql
SELECT key, value FROM ItemTable WHERE key LIKE 'composerData:%';
```

### To get all bubble messages:
```sql
SELECT key, value FROM ItemTable WHERE key LIKE 'bubbleId:%';
```

### To get workspace chat data:
```sql
SELECT key, value FROM ItemTable 
WHERE key = 'composer.composerData' 
   OR key = 'workbench.panel.aichat.view.aichat.chatdata';
```

## Reading Strategy

For complete chat history, read from **all three locations** in this order:
1. Global Storage - User-wide conversations
2. Workspace Storage - Workspace-specific (by workspace ID)
3. Workspace .cursor Directory - Workspace-specific (by absolute path) ⭐ **Most important for workspace chats**

The `.cursor` directory in the workspace root is particularly important because:
- It's tied to the project's absolute path
- It contains workspace-specific chat history
- It's the location users most commonly interact with
- Moving/renaming the project can break access to this data (which is why syncing is important!)

## Conversation Reconstruction

To reconstruct a full conversation:
1. Get all `composerData:<composerId>` entries to get conversation metadata
2. For each composerId, get all `bubbleId:<composerId>:<bubbleId>` entries
3. Sort bubbles by timestamp or order
4. Combine into conversation structure

## References

- [How to find my old cursor chats? A complete guide](https://medium.com/@furry_ai_diary/how-to-find-my-old-cursor-chats-a-complete-guide-bea510218c23)
- [Complete Guide to Managing Cursor AI Chat History](https://www.cursor.fan/tutorial/HowTo/manage-cursor-chat-history/)
- [Reconstruct Cursor chat](https://gist.github.com/loucadufault/6e1d351e0654b529c97b625770475b93)
- [Cursor Community Forum - How to get all chat history](https://forum.cursor.com/t/how-to-get-all-chat-history/16117)
