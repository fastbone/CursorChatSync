import * as path from 'path';
import Database from 'better-sqlite3';
import { DbReader } from './dbReader';

export class DbWriter {
  private dbPath: string;
  private reader: DbReader;

  constructor() {
    this.reader = new DbReader();
    this.dbPath = this.reader.getDbPath();
  }

  writeChatHistory(chatData: any): void {
    try {
      const db = new Database(this.dbPath);
      
      // Ensure the table exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS ItemTable (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // Write chat data
      const stmt = db.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)');
      
      for (const [key, value] of Object.entries(chatData)) {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        stmt.run(key, jsonValue);
      }

      db.close();
    } catch (error: any) {
      throw new Error(`Failed to write chat history: ${error.message}`);
    }
  }

  mergeChatHistory(remoteChatData: any, localChatData: any): any {
    // Simple merge strategy: prefer remote for conflicts, but keep local-only keys
    const merged = { ...localChatData };
    
    for (const [key, value] of Object.entries(remoteChatData)) {
      if (key.includes('chat') || key.includes('conversation')) {
        // For chat-related keys, merge arrays or use remote if it's newer
        if (Array.isArray(value) && Array.isArray(merged[key])) {
          // Merge arrays, avoiding duplicates
          const localArray = merged[key] as any[];
          const remoteArray = value as any[];
          const mergedArray = [...localArray];
          
          for (const remoteItem of remoteArray) {
            const exists = mergedArray.some((item: any) => {
              // Simple comparison - adjust based on your data structure
              return JSON.stringify(item) === JSON.stringify(remoteItem);
            });
            if (!exists) {
              mergedArray.push(remoteItem);
            }
          }
          
          merged[key] = mergedArray;
        } else {
          // Use remote value for conflicts
          merged[key] = value;
        }
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }
}
