import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { DbReader } from '../sync/dbReader';
import { extractConversations } from './conversationIdExtractor';

/**
 * Utility to detect the currently active conversation in Cursor
 * Uses database timestamps to identify the most recently modified conversation
 */

interface ConversationMetadata {
  composerId: string;
  lastUpdatedAt: number;
  createdAt: number;
}

interface DetectionCache {
  conversationId: string | null;
  timestamp: number;
}

export class ActiveConversationDetector {
  private cache: DetectionCache | null = null;
  private cacheTimeout: number = 2000; // Cache for 2 seconds
  private dbReader: DbReader | null = null;

  constructor(workspacePath?: string) {
    if (workspacePath) {
      this.dbReader = new DbReader(workspacePath);
    }
  }

  /**
   * Detect the most recently active conversation
   * @returns The conversation ID (composerId) or null if not found
   */
  async detectActiveConversation(workspacePath?: string): Promise<string | null> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTimeout) {
      return this.cache.conversationId;
    }

    try {
      // Update dbReader if workspace path changed
      if (workspacePath && (!this.dbReader || this.dbReader.getWorkspaceDbPath() !== workspacePath)) {
        this.dbReader = new DbReader(workspacePath);
      }

      // If no dbReader, create one without workspace
      if (!this.dbReader) {
        this.dbReader = new DbReader(workspacePath);
      }

      // Read chat history to get all conversations
      const chatData = this.dbReader.readChatHistory();
      const conversations = extractConversations(chatData);

      if (conversations.size === 0) {
        this.updateCache(null);
        return null;
      }

      // Find the most recently updated conversation
      let mostRecent: ConversationMetadata | null = null;

      for (const [conversationId, conversationData] of conversations.entries()) {
        // Try to get lastUpdatedAt from the conversation data
        let lastUpdatedAt = 0;
        let createdAt = 0;

        if (conversationData && typeof conversationData === 'object') {
          // Check for lastUpdatedAt in various formats
          lastUpdatedAt = 
            conversationData.lastUpdatedAt ||
            conversationData.last_updated_at ||
            conversationData.updatedAt ||
            conversationData.updated_at ||
            conversationData.modifiedAt ||
            conversationData.modified_at ||
            0;

          // Check for createdAt
          createdAt = 
            conversationData.createdAt ||
            conversationData.created_at ||
            conversationData.timestamp ||
            0;

          // If no lastUpdatedAt, use createdAt
          if (!lastUpdatedAt && createdAt) {
            lastUpdatedAt = createdAt;
          }
        }

        // Also check database directly for composerData entries
        if (!lastUpdatedAt) {
          const metadata = this.getConversationMetadataFromDb(conversationId);
          if (metadata) {
            lastUpdatedAt = metadata.lastUpdatedAt || metadata.createdAt || 0;
            createdAt = metadata.createdAt || 0;
          }
        }

        // Use the most recent timestamp
        const timestamp = lastUpdatedAt || createdAt;

        if (!mostRecent || timestamp > mostRecent.lastUpdatedAt) {
          mostRecent = {
            composerId: conversationId,
            lastUpdatedAt: timestamp,
            createdAt: createdAt,
          };
        }
      }

      const activeId = mostRecent ? mostRecent.composerId : null;
      this.updateCache(activeId);
      return activeId;
    } catch (error: any) {
      console.warn('Failed to detect active conversation:', error.message);
      return null;
    }
  }

  /**
   * Get conversation metadata directly from database
   * This is more efficient than reading all chat history
   */
  private getConversationMetadataFromDb(conversationId: string): ConversationMetadata | null {
    try {
      const dbReader = this.dbReader!;
      const dbPath = dbReader.getDbPath();
      
      if (!fs.existsSync(dbPath)) {
        return null;
      }

      const db = new Database(dbPath, { readonly: true });
      
      // Try to find composerData entry
      const key = `composerData:${conversationId}`;
      const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?');
      const result = stmt.get(key) as { value: string } | undefined;
      
      db.close();

      if (result) {
        try {
          const composerData = JSON.parse(result.value);
          return {
            composerId: conversationId,
            lastUpdatedAt: composerData.lastUpdatedAt || composerData.createdAt || 0,
            createdAt: composerData.createdAt || 0,
          };
        } catch {
          return null;
        }
      }

      return null;
    } catch (error: any) {
      console.warn(`Failed to get metadata for conversation ${conversationId}:`, error.message);
      return null;
    }
  }

  /**
   * Update the cache with a new value
   */
  private updateCache(conversationId: string | null): void {
    this.cache = {
      conversationId,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear the cache (useful when database changes are detected)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Get all available conversation IDs
   */
  async getAllConversationIds(workspacePath?: string): Promise<string[]> {
    try {
      if (workspacePath && (!this.dbReader || this.dbReader.getWorkspaceDbPath() !== workspacePath)) {
        this.dbReader = new DbReader(workspacePath);
      }

      if (!this.dbReader) {
        this.dbReader = new DbReader(workspacePath);
      }

      const chatData = this.dbReader.readChatHistory();
      const conversations = extractConversations(chatData);
      return Array.from(conversations.keys());
    } catch (error: any) {
      console.warn('Failed to get conversation IDs:', error.message);
      return [];
    }
  }
}

// Singleton instance for use across the extension
let detectorInstance: ActiveConversationDetector | null = null;

/**
 * Get or create the singleton detector instance
 */
export function getActiveConversationDetector(workspacePath?: string): ActiveConversationDetector {
  if (!detectorInstance) {
    detectorInstance = new ActiveConversationDetector(workspacePath);
  }
  return detectorInstance;
}
