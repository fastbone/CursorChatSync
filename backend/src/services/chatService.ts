import pool from '../db/connection';
import { ChatHistory, UploadChatInput, ChatHistoryResponse } from '../models/ChatHistory';
import permissionService from './permissionService';
import chatLockService from './chatLockService';
import chatExclusionService from './chatExclusionService';
import { extractConversations, filterExcludedConversations } from '../utils/conversationIdExtractor';
import { logger } from '../utils/logger';

export class ChatService {
  async uploadChat(userId: number, input: UploadChatInput): Promise<ChatHistory> {
    // Check permissions
    const canSync = await permissionService.canUserSyncProject(userId, input.project_id);
    
    if (!canSync) {
      // Request permission if not already requested
      await permissionService.requestPermission({
        project_id: input.project_id,
        requester_id: userId,
      });
      logger.logSync('upload', userId, input.project_id, false, new Error('Permission required'));
      throw new Error('Permission required. Request sent to admin for approval.');
    }
    
    // Get excluded conversation IDs for this user and project
    const excludedIds = await chatExclusionService.getExcludedConversationIds(
      userId,
      input.project_id
    );
    
    // Filter out excluded conversations
    let filteredChatData = filterExcludedConversations(input.chat_data, excludedIds);
    
    // Check for locks and filter out locked conversations (read-only sync)
    const conversations = extractConversations(filteredChatData);
    const lockedConversationIds: string[] = [];
    const filteredByLock: Map<string, any> = new Map();
    
    for (const [conversationId, conversationData] of conversations.entries()) {
      const isLocked = await chatLockService.isChatLocked(
        input.project_id,
        conversationId,
        userId
      );
      
      if (isLocked) {
        lockedConversationIds.push(conversationId);
        // Don't include locked conversations in upload (read-only sync)
      } else {
        filteredByLock.set(conversationId, conversationData);
      }
    }
    
    // Reconstruct chat data without locked conversations
    if (lockedConversationIds.length > 0) {
      filteredChatData = this.reconstructFromConversations(filteredChatData, filteredByLock);
    }
    
    // Check if chat history exists
    const existing = await pool.query(
      'SELECT id FROM chat_history WHERE project_id = $1 AND user_id = $2',
      [input.project_id, userId]
    );
    
    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE chat_history
         SET chat_data = $1, workstation_id = $2, last_synced_at = CURRENT_TIMESTAMP
         WHERE project_id = $3 AND user_id = $4
         RETURNING *`,
        [JSON.stringify(filteredChatData), input.workstation_id, input.project_id, userId]
      );
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO chat_history (project_id, user_id, chat_data, workstation_id, last_synced_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [input.project_id, userId, JSON.stringify(filteredChatData), input.workstation_id]
      );
    }
    
    if (result.rows.length === 0) {
      logger.error('Failed to save chat history', undefined, { userId, projectId: input.project_id });
      throw new Error('Failed to save chat history');
    }
    
    const chatHistory = this.mapToChatHistory(result.rows[0]);
    
    // Add lock information to response if any conversations were locked
    if (lockedConversationIds.length > 0) {
      (chatHistory as any).locked_conversations = lockedConversationIds;
      (chatHistory as any).lock_warning = `Some conversations are locked by other users and were not uploaded (read-only sync)`;
    }
    
    logger.logSync('upload', userId, input.project_id, true);
    return chatHistory;
  }
  
  async downloadChat(userId: number, projectId: number): Promise<ChatHistoryResponse | null> {
    // Check permissions
    const canSync = await permissionService.canUserSyncProject(userId, projectId);
    
    if (!canSync) {
      throw new Error('Permission denied');
    }
    
    const result = await pool.query(
      `SELECT * FROM chat_history
       WHERE project_id = $1 AND user_id = $2
       ORDER BY last_synced_at DESC
       LIMIT 1`,
      [projectId, userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const chatHistory = this.mapToChatHistoryResponse(result.rows[0]);
    
    // Filter out excluded conversations
    const excludedIds = await chatExclusionService.getExcludedConversationIds(userId, projectId);
    if (excludedIds.size > 0) {
      chatHistory.chat_data = filterExcludedConversations(chatHistory.chat_data, excludedIds);
    }
    
    // Include lock information for conversations
    const conversations = extractConversations(chatHistory.chat_data);
    const lockInfo: any = {};
    
    for (const conversationId of conversations.keys()) {
      const info = await chatLockService.getLockInfo(projectId, conversationId);
      if (info.is_locked) {
        lockInfo[conversationId] = info;
      }
    }
    
    if (Object.keys(lockInfo).length > 0) {
      (chatHistory as any).lock_info = lockInfo;
    }
    
    return chatHistory;
  }
  
  async getChatHistory(userId: number, projectId?: number): Promise<ChatHistoryResponse[]> {
    let query = `
      SELECT ch.*, p.git_repo_name, u.name as user_name
      FROM chat_history ch
      JOIN projects p ON ch.project_id = p.id
      JOIN users u ON ch.user_id = u.id
      WHERE ch.user_id = $1
    `;
    const params: any[] = [userId];
    
    if (projectId) {
      query += ' AND ch.project_id = $2';
      params.push(projectId);
    }
    
    query += ' ORDER BY ch.last_synced_at DESC';
    
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      user_id: row.user_id,
      chat_data: typeof row.chat_data === 'string' ? JSON.parse(row.chat_data) : row.chat_data,
      last_synced_at: row.last_synced_at,
      workstation_id: row.workstation_id,
      created_at: row.created_at,
    }));
  }
  
  private mapToChatHistory(row: any): ChatHistory {
    return {
      id: row.id,
      project_id: row.project_id,
      user_id: row.user_id,
      chat_data: typeof row.chat_data === 'string' ? JSON.parse(row.chat_data) : row.chat_data,
      last_synced_at: row.last_synced_at,
      workstation_id: row.workstation_id,
      created_at: row.created_at,
    };
  }
  
  private mapToChatHistoryResponse(row: any): ChatHistoryResponse {
    return {
      id: row.id,
      project_id: row.project_id,
      user_id: row.user_id,
      chat_data: typeof row.chat_data === 'string' ? JSON.parse(row.chat_data) : row.chat_data,
      last_synced_at: row.last_synced_at,
      workstation_id: row.workstation_id,
      created_at: row.created_at,
    };
  }

  /**
   * Reconstruct chat data structure from filtered conversations
   */
  private reconstructFromConversations(
    originalData: any,
    filteredConversations: Map<string, any>
  ): any {
    if (Array.isArray(originalData)) {
      return Array.from(filteredConversations.values());
    }

    // Try to preserve original structure
    const result: any = { ...originalData };

    // Update conversation arrays
    const conversationKeys = [
      'conversations',
      'chats',
      'history',
      'messages',
      'conversationHistory',
      'chatHistory',
    ];

    for (const key of conversationKeys) {
      if (result[key] && Array.isArray(result[key])) {
        result[key] = Array.from(filteredConversations.values());
      }
    }

    return result;
  }
}

export default new ChatService();
