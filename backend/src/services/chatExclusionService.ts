import pool from '../db/connection';
import { ChatExclusion, CreateExclusionInput, ExclusionResponse } from '../models/ChatExclusion';

export class ChatExclusionService {
  async excludeConversation(userId: number, input: CreateExclusionInput): Promise<ChatExclusion> {
    // Check if exclusion already exists
    const existing = await pool.query(
      `SELECT * FROM chat_exclusions
       WHERE user_id = $1 AND project_id = $2 AND conversation_id = $3`,
      [userId, input.project_id, input.conversation_id]
    );

    if (existing.rows.length > 0) {
      return this.mapToChatExclusion(existing.rows[0]);
    }

    // Create new exclusion
    const result = await pool.query(
      `INSERT INTO chat_exclusions (user_id, project_id, conversation_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, input.project_id, input.conversation_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create exclusion');
    }

    return this.mapToChatExclusion(result.rows[0]);
  }

  async includeConversation(userId: number, projectId: number, conversationId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM chat_exclusions
       WHERE user_id = $1 AND project_id = $2 AND conversation_id = $3
       RETURNING *`,
      [userId, projectId, conversationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Exclusion not found');
    }
  }

  async isExcluded(userId: number, projectId: number, conversationId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT * FROM chat_exclusions
       WHERE user_id = $1 AND project_id = $2 AND conversation_id = $3`,
      [userId, projectId, conversationId]
    );

    return result.rows.length > 0;
  }

  async getExclusions(userId: number, projectId?: number): Promise<ExclusionResponse[]> {
    let query = `
      SELECT id, project_id, conversation_id, created_at
      FROM chat_exclusions
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (projectId) {
      query += ' AND project_id = $2';
      params.push(projectId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      conversation_id: row.conversation_id,
      created_at: row.created_at,
    }));
  }

  async getExcludedConversationIds(userId: number, projectId: number): Promise<Set<string>> {
    const result = await pool.query(
      `SELECT conversation_id FROM chat_exclusions
       WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId]
    );

    return new Set(result.rows.map(row => row.conversation_id));
  }

  private mapToChatExclusion(row: any): ChatExclusion {
    return {
      id: row.id,
      user_id: row.user_id,
      project_id: row.project_id,
      conversation_id: row.conversation_id,
      created_at: row.created_at,
    };
  }
}

export default new ChatExclusionService();
