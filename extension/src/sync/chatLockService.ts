import * as vscode from 'vscode';
import { ApiClient } from '../api/apiClient';
import { AuthService } from '../auth/authService';
import { extractConversations } from '../utils/conversationIdExtractor';

export interface LockInfo {
  is_locked: boolean;
  locked_by_user_id?: number;
  locked_by_user_name?: string;
  lock_type?: 'auto' | 'manual';
  expires_at?: string | null;
  created_at?: string;
}

export class ChatLockService {
  private apiClient: ApiClient;
  private activeLocks: Map<string, NodeJS.Timeout> = new Map(); // conversationId -> timeout
  private static readonly EXCLUSIONS_KEY = 'cursorChatSync.exclusions';

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Auto-lock conversations when sync starts
   */
  async autoLockConversations(
    projectId: number,
    chatData: any,
    timeoutMinutes: number = 15
  ): Promise<string[]> {
    const conversations = extractConversations(chatData);
    const lockedIds: string[] = [];

    for (const conversationId of conversations.keys()) {
      try {
        await this.apiClient.createLock({
          project_id: projectId,
          conversation_id: conversationId,
          lock_type: 'auto',
          timeout_minutes: timeoutMinutes,
        });
        lockedIds.push(conversationId);

        // Set up auto-unlock timeout
        const timeout = setTimeout(() => {
          this.autoUnlockConversation(projectId, conversationId).catch((err) => {
            console.warn(`Failed to auto-unlock ${conversationId}:`, err);
          });
        }, timeoutMinutes * 60 * 1000);

        this.activeLocks.set(conversationId, timeout);
      } catch (error: any) {
        // If lock already exists or fails, continue
        console.warn(`Failed to lock conversation ${conversationId}:`, error.message);
      }
    }

    return lockedIds;
  }

  /**
   * Auto-unlock conversations when sync completes
   */
  async autoUnlockConversations(projectId: number, conversationIds: string[]): Promise<void> {
    for (const conversationId of conversationIds) {
      await this.autoUnlockConversation(projectId, conversationId);
    }
  }

  private async autoUnlockConversation(projectId: number, conversationId: string): Promise<void> {
    try {
      // Clear timeout if exists
      const timeout = this.activeLocks.get(conversationId);
      if (timeout) {
        clearTimeout(timeout);
        this.activeLocks.delete(conversationId);
      }

      // Unlock on server
      await this.apiClient.removeLock({
        project_id: projectId,
        conversation_id: conversationId,
      });
    } catch (error: any) {
      // Ignore errors for auto-unlock (lock may have expired or been removed)
      console.warn(`Failed to auto-unlock ${conversationId}:`, error.message);
    }
  }

  /**
   * Manually lock a conversation
   */
  async lockConversation(projectId: number, conversationId: string): Promise<void> {
    try {
      await this.apiClient.createLock({
        project_id: projectId,
        conversation_id: conversationId,
        lock_type: 'manual',
      });
      vscode.window.showInformationMessage(`Chat locked: ${conversationId}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to lock chat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Manually unlock a conversation
   */
  async unlockConversation(projectId: number, conversationId: string): Promise<void> {
    try {
      await this.apiClient.removeLock({
        project_id: projectId,
        conversation_id: conversationId,
      });
      vscode.window.showInformationMessage(`Chat unlocked: ${conversationId}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to unlock chat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get lock status for a conversation
   */
  async getLockStatus(projectId: number, conversationId: string): Promise<LockInfo> {
    try {
      return await this.apiClient.getLockStatus(projectId, conversationId);
    } catch (error: any) {
      console.error(`Failed to get lock status:`, error);
      return { is_locked: false };
    }
  }

  /**
   * Check if conversations are locked (by other users)
   */
  async checkLocks(
    projectId: number,
    chatData: any
  ): Promise<{ lockedIds: string[]; lockInfo: Map<string, LockInfo> }> {
    const conversations = extractConversations(chatData);
    const lockedIds: string[] = [];
    const lockInfo = new Map<string, LockInfo>();
    const userId = AuthService.getUser()?.id;

    for (const conversationId of conversations.keys()) {
      const info = await this.getLockStatus(projectId, conversationId);
      if (info.is_locked && info.locked_by_user_id !== userId) {
        lockedIds.push(conversationId);
        lockInfo.set(conversationId, info);
      }
    }

    return { lockedIds, lockInfo };
  }

  /**
   * Get excluded conversation IDs for a project
   */
  getExclusions(projectId: number): Set<string> {
    const exclusions = AuthService.context?.globalState.get<Record<number, string[]>>(
      ChatLockService.EXCLUSIONS_KEY
    ) || {};
    return new Set(exclusions[projectId] || []);
  }

  /**
   * Exclude a conversation from syncing
   */
  async excludeConversation(projectId: number, conversationId: string): Promise<void> {
    try {
      await this.apiClient.excludeConversation({
        project_id: projectId,
        conversation_id: conversationId,
      });

      // Also store locally
      const exclusions = AuthService.context?.globalState.get<Record<number, string[]>>(
        ChatLockService.EXCLUSIONS_KEY
      ) || {};
      if (!exclusions[projectId]) {
        exclusions[projectId] = [];
      }
      if (!exclusions[projectId].includes(conversationId)) {
        exclusions[projectId].push(conversationId);
        await AuthService.context?.globalState.update(ChatLockService.EXCLUSIONS_KEY, exclusions);
      }

      vscode.window.showInformationMessage(`Conversation excluded from sync: ${conversationId}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to exclude conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Include a conversation in syncing (remove exclusion)
   */
  async includeConversation(projectId: number, conversationId: string): Promise<void> {
    try {
      await this.apiClient.includeConversation({
        project_id: projectId,
        conversation_id: conversationId,
      });

      // Also remove from local storage
      const exclusions = AuthService.context?.globalState.get<Record<number, string[]>>(
        ChatLockService.EXCLUSIONS_KEY
      ) || {};
      if (exclusions[projectId]) {
        exclusions[projectId] = exclusions[projectId].filter((id) => id !== conversationId);
        await AuthService.context?.globalState.update(ChatLockService.EXCLUSIONS_KEY, exclusions);
      }

      vscode.window.showInformationMessage(`Conversation included in sync: ${conversationId}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to include conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync exclusions from backend
   */
  async syncExclusions(projectId: number): Promise<void> {
    try {
      const exclusions = await this.apiClient.getExclusions(projectId);
      const localExclusions: Record<number, string[]> = {};
      localExclusions[projectId] = exclusions.map((e) => e.conversation_id);
      await AuthService.context?.globalState.update(ChatLockService.EXCLUSIONS_KEY, localExclusions);
    } catch (error: any) {
      console.warn('Failed to sync exclusions:', error);
    }
  }

  /**
   * Cleanup all active locks (called on extension deactivation)
   */
  dispose(): void {
    for (const timeout of this.activeLocks.values()) {
      clearTimeout(timeout);
    }
    this.activeLocks.clear();
  }
}
