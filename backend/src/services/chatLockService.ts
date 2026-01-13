import pool from '../db/connection';
import { ChatLock, CreateLockInput, LockInfo, ExtendLockInput, LockType } from '../models/ChatLock';

export class ChatLockService {
  async lockChat(userId: number, input: CreateLockInput): Promise<ChatLock> {
    // Calculate expires_at based on lock type and timeout
    let expiresAt: Date | null = null;
    
    if (input.lock_type === 'auto' && input.timeout_minutes) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + input.timeout_minutes);
    } else if (input.lock_type === 'manual') {
      // Manual locks don't expire (or have very long expiration)
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 10); // 10 years from now
    }

    // Check if lock already exists
    const existing = await pool.query(
      `SELECT * FROM chat_locks 
       WHERE project_id = $1 AND conversation_id = $2 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [input.project_id, input.conversation_id]
    );

    if (existing.rows.length > 0) {
      const existingLock = existing.rows[0];
      // If lock is by same user, update it
      if (existingLock.locked_by_user_id === userId) {
        const result = await pool.query(
          `UPDATE chat_locks
           SET lock_type = $1, expires_at = $2, created_at = CURRENT_TIMESTAMP
           WHERE project_id = $3 AND conversation_id = $4
           RETURNING *`,
          [input.lock_type, expiresAt, input.project_id, input.conversation_id]
        );
        return this.mapToChatLock(result.rows[0]);
      } else {
        throw new Error('Chat is already locked by another user');
      }
    }

    // Create new lock
    const result = await pool.query(
      `INSERT INTO chat_locks (project_id, conversation_id, locked_by_user_id, lock_type, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.project_id, input.conversation_id, userId, input.lock_type, expiresAt]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create lock');
    }

    return this.mapToChatLock(result.rows[0]);
  }

  async unlockChat(userId: number, projectId: number, conversationId: string): Promise<void> {
    // Only allow unlocking if user owns the lock
    const result = await pool.query(
      `DELETE FROM chat_locks
       WHERE project_id = $1 AND conversation_id = $2 AND locked_by_user_id = $3
       RETURNING *`,
      [projectId, conversationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Lock not found or you do not have permission to unlock it');
    }
  }

  async isChatLocked(projectId: number, conversationId: string, excludeUserId?: number): Promise<boolean> {
    // Check if there's an active lock (not expired) by another user
    let query = `
      SELECT * FROM chat_locks
      WHERE project_id = $1 AND conversation_id = $2
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params: any[] = [projectId, conversationId];

    if (excludeUserId) {
      query += ' AND locked_by_user_id != $3';
      params.push(excludeUserId);
    }

    const result = await pool.query(query, params);
    return result.rows.length > 0;
  }

  async getLockInfo(projectId: number, conversationId: string): Promise<LockInfo> {
    // Get active lock with user info
    const result = await pool.query(
      `SELECT cl.*, u.name as locked_by_user_name
       FROM chat_locks cl
       JOIN users u ON cl.locked_by_user_id = u.id
       WHERE cl.project_id = $1 AND cl.conversation_id = $2
       AND (cl.expires_at IS NULL OR cl.expires_at > CURRENT_TIMESTAMP)
       ORDER BY cl.created_at DESC
       LIMIT 1`,
      [projectId, conversationId]
    );

    if (result.rows.length === 0) {
      return { is_locked: false };
    }

    const row = result.rows[0];
    return {
      is_locked: true,
      locked_by_user_id: row.locked_by_user_id,
      locked_by_user_name: row.locked_by_user_name,
      lock_type: row.lock_type,
      expires_at: row.expires_at,
      created_at: row.created_at,
    };
  }

  async cleanupExpiredLocks(): Promise<number> {
    // Delete all expired locks
    const result = await pool.query(
      `DELETE FROM chat_locks
       WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
       RETURNING *`
    );

    return result.rows.length;
  }

  async extendLock(userId: number, input: ExtendLockInput): Promise<ChatLock> {
    // Check if lock exists and is owned by user
    const existing = await pool.query(
      `SELECT * FROM chat_locks
       WHERE project_id = $1 AND conversation_id = $2 AND locked_by_user_id = $3
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [input.project_id, input.conversation_id, userId]
    );

    if (existing.rows.length === 0) {
      throw new Error('Lock not found or expired');
    }

    const currentLock = existing.rows[0];
    let newExpiresAt: Date | null = null;

    if (currentLock.expires_at) {
      newExpiresAt = new Date(currentLock.expires_at);
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + input.additional_minutes);
    } else {
      // If no expiration (manual lock), add expiration
      newExpiresAt = new Date();
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + input.additional_minutes);
    }

    const result = await pool.query(
      `UPDATE chat_locks
       SET expires_at = $1
       WHERE project_id = $2 AND conversation_id = $3 AND locked_by_user_id = $4
       RETURNING *`,
      [newExpiresAt, input.project_id, input.conversation_id, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to extend lock');
    }

    return this.mapToChatLock(result.rows[0]);
  }

  async getUserLocks(userId: number, projectId?: number): Promise<ChatLock[]> {
    let query = `
      SELECT * FROM chat_locks
      WHERE locked_by_user_id = $1
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params: any[] = [userId];

    if (projectId) {
      query += ' AND project_id = $2';
      params.push(projectId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map(row => this.mapToChatLock(row));
  }

  private mapToChatLock(row: any): ChatLock {
    return {
      id: row.id,
      project_id: row.project_id,
      conversation_id: row.conversation_id,
      locked_by_user_id: row.locked_by_user_id,
      lock_type: row.lock_type,
      expires_at: row.expires_at,
      created_at: row.created_at,
    };
  }
}

export default new ChatLockService();
