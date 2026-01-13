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
    // Merge strategy: combine both datasets intelligently
    const merged = { ...localChatData };
    
    for (const [key, remoteValue] of Object.entries(remoteChatData)) {
      const localValue = merged[key];
      
      // Handle arrays (conversations, chat history, etc.)
      if (Array.isArray(remoteValue)) {
        if (Array.isArray(localValue)) {
          // Merge arrays by ID or timestamp, avoiding duplicates
          merged[key] = this.mergeArrays(localValue, remoteValue);
        } else {
          // Remote has array, local doesn't - use remote
          merged[key] = remoteValue;
        }
      }
      // Handle objects (nested structures)
      else if (typeof remoteValue === 'object' && remoteValue !== null && !Array.isArray(remoteValue)) {
        if (typeof localValue === 'object' && localValue !== null && !Array.isArray(localValue)) {
          // Recursively merge objects
          merged[key] = this.mergeChatHistory(remoteValue, localValue);
        } else {
          // Remote has object, local doesn't - use remote
          merged[key] = remoteValue;
        }
      }
      // Handle primitive values
      else {
        // For chat-related keys, prefer remote if it exists
        // For other keys, prefer remote if it's newer (if we have timestamp info)
        if (key.includes('chat') || key.includes('conversation') || key.includes('history')) {
          merged[key] = remoteValue;
        } else {
          // For other keys, prefer remote but keep local if remote is undefined/null
          if (remoteValue !== undefined && remoteValue !== null) {
            merged[key] = remoteValue;
          }
        }
      }
    }
    
    return merged;
  }

  private mergeArrays(localArray: any[], remoteArray: any[]): any[] {
    // Create a map to track items by ID or unique identifier
    const mergedMap = new Map<string, any>();
    
    // Add local items first
    for (const item of localArray) {
      const id = this.getItemId(item);
      if (id) {
        mergedMap.set(id, item);
      } else {
        // If no ID, add directly (will be deduplicated by content)
        mergedMap.set(JSON.stringify(item), item);
      }
    }
    
    // Merge remote items
    for (const remoteItem of remoteArray) {
      const id = this.getItemId(remoteItem);
      const existingItem = id ? mergedMap.get(id) : mergedMap.get(JSON.stringify(remoteItem));
      
      if (existingItem) {
        // Item exists - prefer the one with newer timestamp if available
        const existingTimestamp = this.getItemTimestamp(existingItem);
        const remoteTimestamp = this.getItemTimestamp(remoteItem);
        
        if (remoteTimestamp && existingTimestamp) {
          if (new Date(remoteTimestamp) > new Date(existingTimestamp)) {
            mergedMap.set(id || JSON.stringify(remoteItem), remoteItem);
          }
        } else if (remoteTimestamp) {
          // Remote has timestamp, local doesn't - prefer remote
          mergedMap.set(id || JSON.stringify(remoteItem), remoteItem);
        }
        // Otherwise keep existing
      } else {
        // New item - add it
        mergedMap.set(id || JSON.stringify(remoteItem), remoteItem);
      }
    }
    
    // Convert map back to array
    const merged = Array.from(mergedMap.values());
    
    // Sort by timestamp if available
    return this.sortByTimestamp(merged);
  }

  private getItemId(item: any): string | null {
    // Try common ID fields
    if (item.id) return String(item.id);
    if (item.conversationId) return String(item.conversationId);
    if (item.chatId) return String(item.chatId);
    if (item.uuid) return String(item.uuid);
    return null;
  }

  private getItemTimestamp(item: any): string | null {
    // Try common timestamp fields
    if (item.timestamp) return item.timestamp;
    if (item.createdAt) return item.createdAt;
    if (item.updatedAt) return item.updatedAt;
    if (item.date) return item.date;
    if (item.time) return item.time;
    if (item.lastModified) return item.lastModified;
    return null;
  }

  private sortByTimestamp(items: any[]): any[] {
    return items.sort((a, b) => {
      const timestampA = this.getItemTimestamp(a);
      const timestampB = this.getItemTimestamp(b);
      
      if (!timestampA && !timestampB) return 0;
      if (!timestampA) return 1; // Items without timestamp go to end
      if (!timestampB) return -1;
      
      return new Date(timestampA).getTime() - new Date(timestampB).getTime();
    });
  }
}
