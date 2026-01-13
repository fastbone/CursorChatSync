import pool from '../db/connection';
import { ChatHistory, UploadChatInput, ChatHistoryResponse } from '../models/ChatHistory';
import permissionService from './permissionService';

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
      throw new Error('Permission required. Request sent to admin for approval.');
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
        [JSON.stringify(input.chat_data), input.workstation_id, input.project_id, userId]
      );
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO chat_history (project_id, user_id, chat_data, workstation_id, last_synced_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [input.project_id, userId, JSON.stringify(input.chat_data), input.workstation_id]
      );
    }
    
    if (result.rows.length === 0) {
      throw new Error('Failed to save chat history');
    }
    
    return this.mapToChatHistory(result.rows[0]);
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
    
    return this.mapToChatHistoryResponse(result.rows[0]);
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
}

export default new ChatService();
