import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { validateChatData, getChatDataSummary } from '../utils/chatDataValidator';

export class DbReader {
  private globalStoragePath: string;
  private workspaceStoragePath: string | null = null;
  private workspaceCursorPath: string | null = null; // .cursor directory in workspace root
  private workspacePath: string | undefined; // Track workspace path for backup service

  constructor(workspacePath?: string) {
    this.workspacePath = workspacePath;
    // Cursor stores state.vscdb in multiple locations:
    // 1. Global storage (user-wide)
    const userDataDir = this.getUserDataDirectory();
    this.globalStoragePath = path.join(userDataDir, 'User', 'globalStorage', 'state.vscdb');
    
    // 2. Workspace storage (in user data directory, workspace-specific)
    if (workspacePath) {
      this.workspaceStoragePath = this.findWorkspaceStoragePath(userDataDir, workspacePath);
      
      // 3. Workspace .cursor directory (in project root, workspace-specific)
      // This is tied to the absolute path of the project
      const workspaceCursorDir = path.join(workspacePath, '.cursor');
      const workspaceCursorDb = path.join(workspaceCursorDir, 'state.vscdb');
      if (fs.existsSync(workspaceCursorDb)) {
        this.workspaceCursorPath = workspaceCursorDb;
      }
    }
  }

  private getUserDataDirectory(): string {
    // On Linux: ~/.config/Cursor
    // On macOS: ~/Library/Application Support/Cursor
    // On Windows: %APPDATA%\Cursor
    const platform = process.platform;
    const homeDir = os.homedir();

    switch (platform) {
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Cursor');
      case 'win32':
        return path.join(process.env.APPDATA || '', 'Cursor');
      default:
        return path.join(homeDir, '.config', 'Cursor');
    }
  }

  /**
   * Find workspace storage path by matching workspace path
   * Workspace IDs are typically hashes, so we need to check each directory
   */
  private findWorkspaceStoragePath(userDataDir: string, workspacePath: string): string | null {
    try {
      const workspaceStorageDir = path.join(userDataDir, 'User', 'workspaceStorage');
      if (!fs.existsSync(workspaceStorageDir)) {
        return null;
      }

      const entries = fs.readdirSync(workspaceStorageDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const workspaceDbPath = path.join(workspaceStorageDir, entry.name, 'state.vscdb');
          if (fs.existsSync(workspaceDbPath)) {
            // Could add additional validation here to match workspace path
            // For now, return the first found workspace storage
            return workspaceDbPath;
          }
        }
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  getDbPath(): string {
    return this.globalStoragePath;
  }

  getWorkspaceDbPath(): string | null {
    return this.workspaceStoragePath;
  }

  readChatHistory(): any {
    const allChatData: any = {};

    // Read from global storage (user-wide chat history)
    try {
      if (fs.existsSync(this.globalStoragePath)) {
        const globalData = this.readFromDatabase(this.globalStoragePath);
        Object.assign(allChatData, globalData);
      }
    } catch (error: any) {
      console.warn(`Failed to read global storage: ${error.message}`);
    }

    // Read from workspace storage (in user data directory, workspace-specific)
    if (this.workspaceStoragePath && fs.existsSync(this.workspaceStoragePath)) {
      try {
        const workspaceData = this.readFromDatabase(this.workspaceStoragePath);
        Object.assign(allChatData, workspaceData);
      } catch (error: any) {
        console.warn(`Failed to read workspace storage: ${error.message}`);
      }
    }

    // Read from workspace .cursor directory (in project root, workspace-specific)
    // This is tied to the absolute path of the project and contains workspace-specific chats
    if (this.workspaceCursorPath && fs.existsSync(this.workspaceCursorPath)) {
      try {
        const workspaceCursorData = this.readFromDatabase(this.workspaceCursorPath);
        Object.assign(allChatData, workspaceCursorData);
      } catch (error: any) {
        console.warn(`Failed to read workspace .cursor directory: ${error.message}`);
      }
    }

    // Reconstruct conversations from composerData and bubbleId entries
    const reconstructed = this.reconstructConversations(allChatData);

    // Validate chat data structure
    const validation = validateChatData(reconstructed);
    if (validation.errors.length > 0) {
      throw new Error(`Invalid chat data structure: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      // Log warnings but don't fail
      console.warn('Chat data validation warnings:', validation.warnings);
      console.warn('Chat data summary:', getChatDataSummary(reconstructed));
    }

    return reconstructed;
  }

  /**
   * Read chat data from a specific database file
   */
  private readFromDatabase(dbPath: string): any {
    const db = new Database(dbPath, { readonly: true });
    
    // Query chat history using Cursor's actual key patterns
    // Global storage: composerData:<composerId> and bubbleId:<composerId>:<bubbleId>
    // Workspace storage: composer.composerData and workbench.panel.aichat.view.aichat.chatdata
    const stmt = db.prepare(`
      SELECT key, value 
      FROM ItemTable 
      WHERE key LIKE 'composerData:%' 
         OR key LIKE 'bubbleId:%'
         OR key = 'composer.composerData'
         OR key = 'workbench.panel.aichat.view.aichat.chatdata'
    `);
    
    const rows = stmt.all() as Array<{ key: string; value: string | Buffer }>;
    db.close();

    // Parse the values (they're stored as JSON strings or BLOB)
    const chatData: any = {};
    for (const row of rows) {
      try {
        // Handle both string and Buffer values
        let value: string = row.value as string;
        if (Buffer.isBuffer(row.value)) {
          value = row.value.toString('utf8');
        } else if (typeof row.value !== 'string') {
          value = String(row.value);
        }
        chatData[row.key] = JSON.parse(value);
      } catch {
        // If parsing fails, store as string
        let value: string = row.value as string;
        if (Buffer.isBuffer(row.value)) {
          value = row.value.toString('utf8');
        } else if (typeof row.value !== 'string') {
          value = String(row.value);
        }
        chatData[row.key] = value;
      }
    }

    return chatData;
  }

  /**
   * Reconstruct conversations from Cursor's composerData and bubbleId structure
   * Based on research: https://medium.com/@furry_ai_diary/how-to-find-my-old-cursor-chats-a-complete-guide-bea510218c23
   */
  private reconstructConversations(rawData: any): any {
    const conversations: any[] = [];
    const composerDataMap = new Map<string, any>();
    const bubbleMap = new Map<string, any[]>();

    // First pass: collect composerData entries and bubbleId entries
    for (const [key, value] of Object.entries(rawData)) {
      if (key.startsWith('composerData:')) {
        const composerId = key.substring('composerData:'.length);
        composerDataMap.set(composerId, value);
      } else if (key.startsWith('bubbleId:')) {
        // Parse bubbleId:<composerId>:<bubbleId>
        const parts = key.substring('bubbleId:'.length).split(':');
        if (parts.length >= 2) {
          const composerId = parts[0];
          const bubbleId = parts.slice(1).join(':'); // Handle cases where bubbleId contains ':'
          
          if (!bubbleMap.has(composerId)) {
            bubbleMap.set(composerId, []);
          }
          bubbleMap.get(composerId)!.push({
            ...(value as any),
            bubbleId,
            _key: key, // Preserve original key for reference
          });
        }
      }
    }

    // Second pass: reconstruct conversations from composerData and their bubbles
    for (const [composerId, composerData] of composerDataMap.entries()) {
      const bubbles = bubbleMap.get(composerId) || [];
      
      // Sort bubbles if they have timestamps or order fields
      bubbles.sort((a, b) => {
        const aTime = a.timestamp || a.createdAt || a.order || 0;
        const bTime = b.timestamp || b.createdAt || b.order || 0;
        return aTime - bTime;
      });

      conversations.push({
        composerId,
        conversationId: composerId, // For compatibility with existing code
        id: composerId, // For compatibility with existing code
        ...composerData,
        messages: bubbles,
        messageCount: bubbles.length,
        _source: 'composerData', // Indicate source
      });
    }

    // Also include workspace-specific chat data if present
    if (rawData['composer.composerData']) {
      const workspaceData = rawData['composer.composerData'];
      if (Array.isArray(workspaceData)) {
        workspaceData.forEach((conv, index) => {
          conversations.push({
            ...conv,
            _source: 'composer.composerData',
            _index: index,
          });
        });
      } else if (workspaceData && typeof workspaceData === 'object') {
        conversations.push({
          ...workspaceData,
          _source: 'composer.composerData',
        });
      }
    }

    if (rawData['workbench.panel.aichat.view.aichat.chatdata']) {
      const legacyData = rawData['workbench.panel.aichat.view.aichat.chatdata'];
      if (Array.isArray(legacyData)) {
        legacyData.forEach((conv, index) => {
          conversations.push({
            ...conv,
            _source: 'workbench.panel.aichat.view.aichat.chatdata',
            _index: index,
          });
        });
      } else if (legacyData && typeof legacyData === 'object') {
        conversations.push({
          ...legacyData,
          _source: 'workbench.panel.aichat.view.aichat.chatdata',
        });
      }
    }

    // Return in a format compatible with existing code
    return {
      conversations,
      _raw: rawData, // Preserve raw data for reference
      _metadata: {
        composerCount: composerDataMap.size,
        totalBubbles: Array.from(bubbleMap.values()).reduce((sum, bubbles) => sum + bubbles.length, 0),
        totalConversations: conversations.length,
        reconstructedAt: new Date().toISOString(),
      },
    };
  }

  readAllState(): any {
    try {
      const db = new Database(this.globalStoragePath, { readonly: true });
      const stmt = db.prepare('SELECT key, value FROM ItemTable');
      const rows = stmt.all() as Array<{ key: string; value: string | Buffer }>;
      db.close();

      const state: any = {};
      for (const row of rows) {
        try {
          let value: string = row.value as string;
          if (Buffer.isBuffer(row.value)) {
            value = row.value.toString('utf8');
          } else if (typeof row.value !== 'string') {
            value = String(row.value);
          }
          state[row.key] = JSON.parse(value);
        } catch {
          let value: string = row.value as string;
          if (Buffer.isBuffer(row.value)) {
            value = row.value.toString('utf8');
          } else if (typeof row.value !== 'string') {
            value = String(row.value);
          }
          state[row.key] = value;
        }
      }

      return state;
    } catch (error: any) {
      throw new Error(`Failed to read state: ${error.message}`);
    }
  }

  exists(): boolean {
    try {
      return fs.existsSync(this.globalStoragePath) || 
             (this.workspaceStoragePath !== null && fs.existsSync(this.workspaceStoragePath)) ||
             (this.workspaceCursorPath !== null && fs.existsSync(this.workspaceCursorPath));
    } catch {
      return false;
    }
  }

  getWorkspaceCursorPath(): string | null {
    return this.workspaceCursorPath;
  }

  getWorkspaceStoragePath(): string | null {
    return this.workspaceStoragePath;
  }

  getWorkspacePath(): string | undefined {
    return this.workspacePath;
  }
}
