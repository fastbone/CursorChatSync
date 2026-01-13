import * as vscode from 'vscode';
import { SyncManager } from '../sync/syncManager';
import { ChatLockService } from '../sync/chatLockService';
import { ApiClient } from '../api/apiClient';
import { AuthService } from '../auth/authService';
import { getActiveConversationDetector } from '../utils/activeConversationDetector';
import { extractConversations } from '../utils/conversationIdExtractor';
import { DbReader } from '../sync/dbReader';
import { logger } from '../utils/logger';

/**
 * Register context menu commands for chat sync operations
 */
export function registerContextMenuCommands(
  context: vscode.ExtensionContext,
  syncManager: SyncManager | null,
  chatLockService: ChatLockService,
  apiClient: ApiClient
) {
  // Helper function to get project ID
  async function getProjectId(): Promise<number | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }

    const gitRepoUrl = await getGitRepoUrl(workspaceFolder.uri.fsPath);
    const projectId = AuthService.getProjectMapping(gitRepoUrl);
    return projectId;
  }

  // Helper function to detect or select conversation ID
  async function getConversationId(
    providedId?: string,
    allowSelection: boolean = true
  ): Promise<string | null> {
    // If ID is provided, use it
    if (providedId) {
      return providedId;
    }

    // Try to detect active conversation
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspacePath = workspaceFolder?.uri.fsPath;
    const detector = getActiveConversationDetector(workspacePath);
    
    try {
      const activeId = await detector.detectActiveConversation(workspacePath);
      if (activeId) {
        return activeId;
      }
    } catch (error: any) {
      logger.info('Failed to detect active conversation:', error.message);
    }

    // If detection failed and selection is allowed, let user select
    if (allowSelection) {
      try {
        const workspacePath = workspaceFolder?.uri.fsPath;
        if (!workspacePath) {
          return null;
        }

        const dbReader = new DbReader(workspacePath);
        if (!dbReader.exists()) {
          vscode.window.showErrorMessage('state.vscdb not found');
          return null;
        }

        const chatData = dbReader.readChatHistory();
        const conversations = extractConversations(chatData);

        if (conversations.size === 0) {
          vscode.window.showInformationMessage('No conversations found');
          return null;
        }

        const conversationIds = Array.from(conversations.keys());
        const selected = await vscode.window.showQuickPick(conversationIds, {
          placeHolder: 'Select conversation',
        });

        return selected || null;
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get conversations: ${error.message}`);
        return null;
      }
    }

    return null;
  }

  // Sync conversation command
  const syncConversationCommand = vscode.commands.registerCommand(
    'cursorChatSync.syncConversation',
    async (conversationId?: string) => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      if (!syncManager) {
        vscode.window.showErrorMessage('Sync manager not initialized. Please reload the window.');
        return;
      }

      try {
        const detectedId = await getConversationId(conversationId, false);
        if (!detectedId) {
          vscode.window.showWarningMessage('Could not detect active conversation. Please use "Sync Chat History Now" command instead.');
          return;
        }

        // Sync with conversation filter
        await syncManager.syncNow(0, detectedId);
        vscode.window.showInformationMessage(`Synced conversation: ${detectedId}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to sync conversation: ${error.message}`);
      }
    }
  );

  // Lock conversation command
  const lockConversationCommand = vscode.commands.registerCommand(
    'cursorChatSync.lockConversation',
    async (conversationId?: string) => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const projectId = await getProjectId();
        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        const detectedId = await getConversationId(conversationId);
        if (!detectedId) {
          vscode.window.showInformationMessage('No conversation selected');
          return;
        }

        await chatLockService.lockConversation(projectId, detectedId);
        vscode.window.showInformationMessage(`Locked conversation: ${detectedId}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to lock conversation: ${error.message}`);
      }
    }
  );

  // Unlock conversation command
  const unlockConversationCommand = vscode.commands.registerCommand(
    'cursorChatSync.unlockConversation',
    async (conversationId?: string) => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const projectId = await getProjectId();
        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        const detectedId = await getConversationId(conversationId);
        if (!detectedId) {
          vscode.window.showInformationMessage('No conversation selected');
          return;
        }

        await chatLockService.unlockConversation(projectId, detectedId);
        vscode.window.showInformationMessage(`Unlocked conversation: ${detectedId}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to unlock conversation: ${error.message}`);
      }
    }
  );

  // Exclude conversation command
  const excludeConversationCommand = vscode.commands.registerCommand(
    'cursorChatSync.excludeConversation',
    async (conversationId?: string) => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const projectId = await getProjectId();
        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        const detectedId = await getConversationId(conversationId);
        if (!detectedId) {
          vscode.window.showInformationMessage('No conversation selected');
          return;
        }

        await chatLockService.excludeConversation(projectId, detectedId);
        vscode.window.showInformationMessage(`Excluded conversation from sync: ${detectedId}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to exclude conversation: ${error.message}`);
      }
    }
  );

  // Include conversation command
  const includeConversationCommand = vscode.commands.registerCommand(
    'cursorChatSync.includeConversation',
    async (conversationId?: string) => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const projectId = await getProjectId();
        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        // For include, we need to get excluded conversations
        const exclusions = await apiClient.getExclusions(projectId);
        if (exclusions.length === 0) {
          vscode.window.showInformationMessage('No excluded conversations found');
          return;
        }

        let selectedId = conversationId;
        
        // If no ID provided, let user select from excluded conversations
        if (!selectedId) {
          const excludedIds = exclusions.map((e) => e.conversation_id);
          const selected = await vscode.window.showQuickPick(excludedIds, {
            placeHolder: 'Select conversation to include in sync',
          });
          selectedId = selected || undefined;
        }

        if (!selectedId) {
          vscode.window.showInformationMessage('No conversation selected');
          return;
        }

        await chatLockService.includeConversation(projectId, selectedId);
        vscode.window.showInformationMessage(`Included conversation in sync: ${selectedId}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to include conversation: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(
    syncConversationCommand,
    lockConversationCommand,
    unlockConversationCommand,
    excludeConversationCommand,
    includeConversationCommand
  );
}

/**
 * Helper function to get git repo URL from workspace path
 */
async function getGitRepoUrl(workspacePath: string): Promise<string> {
  const path = require('path');
  const fs = require('fs');
  const gitConfigPath = path.join(workspacePath, '.git', 'config');

  if (fs.existsSync(gitConfigPath)) {
    try {
      const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');
      const urlMatch = gitConfig.match(/url\s*=\s*(.+)/);
      if (urlMatch) {
        return urlMatch[1].trim();
      }
    } catch (error) {
      // Fall through to default
    }
  }

  return `file://${workspacePath}`;
}
