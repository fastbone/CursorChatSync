import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

export class DbReader {
  private dbPath: string;

  constructor() {
    // Cursor stores state.vscdb in the user data directory
    const userDataDir = this.getUserDataDirectory();
    this.dbPath = path.join(userDataDir, 'User', 'globalStorage', 'state.vscdb');
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

  getDbPath(): string {
    return this.dbPath;
  }

  readChatHistory(): any {
    try {
      const db = new Database(this.dbPath, { readonly: true });
      
      // Query chat history from the state database
      // The exact table structure may vary, but typically it's stored in a key-value format
      // We'll look for chat-related keys
      const stmt = db.prepare(`
        SELECT key, value 
        FROM ItemTable 
        WHERE key LIKE '%chat%' OR key LIKE '%conversation%'
      `);
      
      const rows = stmt.all() as Array<{ key: string; value: string }>;
      db.close();

      // Parse the values (they're typically stored as JSON strings)
      const chatData: any = {};
      for (const row of rows) {
        try {
          chatData[row.key] = JSON.parse(row.value);
        } catch {
          chatData[row.key] = row.value;
        }
      }

      return chatData;
    } catch (error: any) {
      throw new Error(`Failed to read chat history: ${error.message}`);
    }
  }

  readAllState(): any {
    try {
      const db = new Database(this.dbPath, { readonly: true });
      const stmt = db.prepare('SELECT key, value FROM ItemTable');
      const rows = stmt.all() as Array<{ key: string; value: string }>;
      db.close();

      const state: any = {};
      for (const row of rows) {
        try {
          state[row.key] = JSON.parse(row.value);
        } catch {
          state[row.key] = row.value;
        }
      }

      return state;
    } catch (error: any) {
      throw new Error(`Failed to read state: ${error.message}`);
    }
  }

  exists(): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(this.dbPath);
    } catch {
      return false;
    }
  }
}
