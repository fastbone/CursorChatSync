import * as vscode from 'vscode';
import { SyncManager } from './sync/syncManager';
import { AuthService } from './auth/authService';
import { ApiClient } from './api/apiClient';
import { registerCommands } from './commands/syncCommands';
import { registerChatLockCommands } from './commands/chatLockCommands';
import { registerBackupCommands } from './commands/backupCommands';
import { ChatLockService } from './sync/chatLockService';

let syncManager: SyncManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Set auth service context
  AuthService.context = context;

  // Get configuration
  const config = vscode.workspace.getConfiguration('cursorChatSync');
  const apiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api');
  const autoSyncInterval = config.get<number>('autoSyncInterval', 600000); // 10 minutes
  const enableAutoSync = config.get<boolean>('enableAutoSync', true);
  const enableFileWatching = config.get<boolean>('enableFileWatching', true);
  const fileWatchDebounce = config.get<number>('fileWatchDebounce', 5000); // 5 seconds

  // Initialize sync manager
  syncManager = new SyncManager(apiUrl);

  // Create separate ApiClient instance for commands (shares same base URL)
  // This allows commands to work independently while syncManager manages its own instance
  const apiClientForCommands = new ApiClient(apiUrl);
  const token = AuthService.getToken();
  if (token) {
    apiClientForCommands.setToken(token);
  }
  const chatLockService = new ChatLockService(apiClientForCommands);

  // Register commands
  registerCommands(context, syncManager);
  registerChatLockCommands(context, chatLockService, apiClientForCommands);
  
  // Register backup commands
  // Create dbWriter instance for backup commands (will share same backup directory)
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const workspacePath = workspaceFolder?.uri.fsPath;
  const maxBackups = config.get<number>('maxBackups', 10);
  const { DbWriter } = require('./sync/dbWriter');
  const dbWriter = new DbWriter(workspacePath);
  dbWriter.getBackupService().setMaxBackups(maxBackups);
  registerBackupCommands(context, dbWriter);

  // Start auto-sync if enabled
  if (enableAutoSync && AuthService.isAuthenticated()) {
    syncManager.startAutoSync(autoSyncInterval);
  }

  // Start file watching if enabled
  if (enableFileWatching && AuthService.isAuthenticated()) {
    syncManager.startFileWatching(fileWatchDebounce);
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cursorChatSync')) {
        const newConfig = vscode.workspace.getConfiguration('cursorChatSync');
        const newInterval = newConfig.get<number>('autoSyncInterval', 600000);
        const newEnableAutoSync = newConfig.get<boolean>('enableAutoSync', true);
        const newEnableFileWatching = newConfig.get<boolean>('enableFileWatching', true);
        const newFileWatchDebounce = newConfig.get<number>('fileWatchDebounce', 5000);

        if (syncManager) {
          syncManager.stopAutoSync();
          syncManager.stopFileWatching();
          
          if (newEnableAutoSync && AuthService.isAuthenticated()) {
            syncManager.startAutoSync(newInterval);
          }
          
          if (newEnableFileWatching && AuthService.isAuthenticated()) {
            syncManager.startFileWatching(newFileWatchDebounce);
          }
        }
      }
    })
  );

  vscode.window.showInformationMessage('Cursor Chat Sync extension activated');
}

export function deactivate() {
  if (syncManager) {
    syncManager.stopAutoSync();
    syncManager.dispose();
    syncManager = null;
  }
}
