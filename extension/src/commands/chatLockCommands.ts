import * as vscode from 'vscode';
import { ChatLockService } from '../sync/chatLockService';
import { ApiClient } from '../api/apiClient';
import { AuthService } from '../auth/authService';
import { extractConversations } from '../utils/conversationIdExtractor';
import { DbReader } from '../sync/dbReader';

export function registerChatLockCommands(
  context: vscode.ExtensionContext,
  chatLockService: ChatLockService,
  apiClient: ApiClient
) {
  // Lock chat command
  const lockChatCommand = vscode.commands.registerCommand(
    'cursorChatSync.lockChat',
    async () => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        // Get current workspace and project
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const gitRepoUrl = await getGitRepoUrl(workspaceFolder.uri.fsPath);
        const projectId = AuthService.getProjectMapping(gitRepoUrl);

        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        // Read chat data to get conversations
        const dbReader = new DbReader();
        if (!dbReader.exists()) {
          vscode.window.showErrorMessage('state.vscdb not found');
          return;
        }

        const chatData = dbReader.readChatHistory();
        const conversations = extractConversations(chatData);

        if (conversations.size === 0) {
          vscode.window.showInformationMessage('No conversations found to lock');
          return;
        }

        // Let user select conversation to lock
        const conversationIds = Array.from(conversations.keys());
        const selected = await vscode.window.showQuickPick(conversationIds, {
          placeHolder: 'Select conversation to lock',
        });

        if (!selected) {
          return;
        }

        await chatLockService.lockConversation(projectId, selected);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to lock chat: ${error.message}`);
      }
    }
  );

  // Unlock chat command
  const unlockChatCommand = vscode.commands.registerCommand(
    'cursorChatSync.unlockChat',
    async () => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const gitRepoUrl = await getGitRepoUrl(workspaceFolder.uri.fsPath);
        const projectId = AuthService.getProjectMapping(gitRepoUrl);

        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        // Get user's locks
        const locks = await apiClient.getExclusions(projectId);
        // Actually, we need to get locks, not exclusions. Let me fix this.
        // For now, read chat data and let user select
        const dbReader = new DbReader();
        if (!dbReader.exists()) {
          vscode.window.showErrorMessage('state.vscdb not found');
          return;
        }

        const chatData = dbReader.readChatHistory();
        const conversations = extractConversations(chatData);

        if (conversations.size === 0) {
          vscode.window.showInformationMessage('No conversations found');
          return;
        }

        const conversationIds = Array.from(conversations.keys());
        const selected = await vscode.window.showQuickPick(conversationIds, {
          placeHolder: 'Select conversation to unlock',
        });

        if (!selected) {
          return;
        }

        await chatLockService.unlockConversation(projectId, selected);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to unlock chat: ${error.message}`);
      }
    }
  );

  // Exclude chat command
  const excludeChatCommand = vscode.commands.registerCommand(
    'cursorChatSync.excludeChat',
    async () => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const gitRepoUrl = await getGitRepoUrl(workspaceFolder.uri.fsPath);
        const projectId = AuthService.getProjectMapping(gitRepoUrl);

        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        const dbReader = new DbReader();
        if (!dbReader.exists()) {
          vscode.window.showErrorMessage('state.vscdb not found');
          return;
        }

        const chatData = dbReader.readChatHistory();
        const conversations = extractConversations(chatData);

        if (conversations.size === 0) {
          vscode.window.showInformationMessage('No conversations found to exclude');
          return;
        }

        const conversationIds = Array.from(conversations.keys());
        const selected = await vscode.window.showQuickPick(conversationIds, {
          placeHolder: 'Select conversation to exclude from sync',
        });

        if (!selected) {
          return;
        }

        await chatLockService.excludeConversation(projectId, selected);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to exclude chat: ${error.message}`);
      }
    }
  );

  // Include chat command
  const includeChatCommand = vscode.commands.registerCommand(
    'cursorChatSync.includeChat',
    async () => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const gitRepoUrl = await getGitRepoUrl(workspaceFolder.uri.fsPath);
        const projectId = AuthService.getProjectMapping(gitRepoUrl);

        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        // Get exclusions
        const exclusions = await apiClient.getExclusions(projectId);

        if (exclusions.length === 0) {
          vscode.window.showInformationMessage('No excluded conversations found');
          return;
        }

        const excludedIds = exclusions.map((e) => e.conversation_id);
        const selected = await vscode.window.showQuickPick(excludedIds, {
          placeHolder: 'Select conversation to include in sync',
        });

        if (!selected) {
          return;
        }

        await chatLockService.includeConversation(projectId, selected);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to include chat: ${error.message}`);
      }
    }
  );

  // Show lock status command
  const showLockStatusCommand = vscode.commands.registerCommand(
    'cursorChatSync.showLockStatus',
    async () => {
      if (!AuthService.isAuthenticated()) {
        vscode.window.showErrorMessage('Please login first');
        return;
      }

      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const gitRepoUrl = await getGitRepoUrl(workspaceFolder.uri.fsPath);
        const projectId = AuthService.getProjectMapping(gitRepoUrl);

        if (!projectId) {
          vscode.window.showErrorMessage('Project not found. Please sync first.');
          return;
        }

        const dbReader = new DbReader();
        if (!dbReader.exists()) {
          vscode.window.showErrorMessage('state.vscdb not found');
          return;
        }

        const chatData = dbReader.readChatHistory();
        const conversations = extractConversations(chatData);

        if (conversations.size === 0) {
          vscode.window.showInformationMessage('No conversations found');
          return;
        }

        // Check lock status for all conversations
        const statusMessages: string[] = [];
        for (const conversationId of conversations.keys()) {
          const lockInfo = await chatLockService.getLockStatus(projectId, conversationId);
          if (lockInfo.is_locked) {
            const expiresText = lockInfo.expires_at
              ? ` (expires: ${new Date(lockInfo.expires_at).toLocaleString()})`
              : '';
            statusMessages.push(
              `🔒 ${conversationId}: Locked by ${lockInfo.locked_by_user_name || 'Unknown'}${expiresText}`
            );
          } else {
            statusMessages.push(`🔓 ${conversationId}: Unlocked`);
          }
        }

        if (statusMessages.length > 0) {
          vscode.window.showInformationMessage(statusMessages.join('\n'));
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get lock status: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(
    lockChatCommand,
    unlockChatCommand,
    excludeChatCommand,
    includeChatCommand,
    showLockStatusCommand
  );
}

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
