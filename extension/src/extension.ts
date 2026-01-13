import * as vscode from 'vscode';
import { SyncManager } from './sync/syncManager';
import { AuthService } from './auth/authService';
import { ApiClient } from './api/apiClient';
import { registerCommands } from './commands/syncCommands';
import { registerChatLockCommands } from './commands/chatLockCommands';
import { registerBackupCommands } from './commands/backupCommands';
import { ChatLockService } from './sync/chatLockService';

let syncManager: SyncManager | null = null;
let fallbackStatusBar: vscode.StatusBarItem | null = null;

export function activate(context: vscode.ExtensionContext) {
  try {
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
    try {
      syncManager = new SyncManager(apiUrl);
    } catch (error: any) {
      console.error('Failed to initialize SyncManager:', error);
      vscode.window.showErrorMessage(
        `Cursor Chat Sync: Failed to initialize. ${error.message}. Please check the output panel for details.`
      );
      // Create fallback status bar if sync manager failed
      fallbackStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      const isAuthenticated = AuthService.isAuthenticated();
      if (isAuthenticated) {
        fallbackStatusBar.text = '$(sync-ignored) Chat Sync: Error';
        fallbackStatusBar.tooltip = 'Chat Sync initialization failed. Click to login.';
      } else {
        fallbackStatusBar.text = '$(sync-ignored) Chat Sync: Not logged in';
        fallbackStatusBar.tooltip = 'Click to login to Chat Sync';
      }
      fallbackStatusBar.command = 'cursorChatSync.login';
      fallbackStatusBar.show();
      context.subscriptions.push(fallbackStatusBar);
    }

    // Create separate ApiClient instance for commands (shares same base URL)
    // This allows commands to work independently while syncManager manages its own instance
    const apiClientForCommands = new ApiClient(apiUrl);
    const token = AuthService.getToken();
    if (token) {
      apiClientForCommands.setToken(token);
    }
    const chatLockService = new ChatLockService(apiClientForCommands);

    // Register commands
    if (syncManager) {
      registerCommands(context, syncManager);
    } else {
      // Register commands with a null sync manager - they'll handle it gracefully
      registerCommands(context, null as any);
    }

    registerChatLockCommands(context, chatLockService, apiClientForCommands);
    
    // Register backup commands
    // Create dbWriter instance for backup commands (will share same backup directory)
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspacePath = workspaceFolder?.uri.fsPath;
      const maxBackups = config.get<number>('maxBackups', 10);
      const { DbWriter } = require('./sync/dbWriter');
      const dbWriter = new DbWriter(workspacePath);
      dbWriter.getBackupService().setMaxBackups(maxBackups);
      registerBackupCommands(context, dbWriter);
    } catch (error: any) {
      console.error('Failed to initialize backup commands:', error);
      // Continue without backup commands
    }

    // Start auto-sync if enabled
    if (syncManager && enableAutoSync && AuthService.isAuthenticated()) {
      syncManager.startAutoSync(autoSyncInterval);
    }

    // Start file watching if enabled
    if (syncManager && enableFileWatching && AuthService.isAuthenticated()) {
      syncManager.startFileWatching(fileWatchDebounce);
    }

    // Watch for configuration changes
    context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cursorChatSync')) {
        const newConfig = vscode.workspace.getConfiguration('cursorChatSync');
        const newApiUrl = newConfig.get<string>('apiUrl', 'http://localhost:3000/api');
        const newInterval = newConfig.get<number>('autoSyncInterval', 600000);
        const newEnableAutoSync = newConfig.get<boolean>('enableAutoSync', true);
        const newEnableFileWatching = newConfig.get<boolean>('enableFileWatching', true);
        const newFileWatchDebounce = newConfig.get<number>('fileWatchDebounce', 5000);

        // If API URL changed, update sync manager
        if (e.affectsConfiguration('cursorChatSync.apiUrl')) {
          if (syncManager) {
            syncManager.updateApiUrl(newApiUrl);
          } else {
            // If syncManager doesn't exist yet, create it
            syncManager = new SyncManager(newApiUrl);
          }
        } else {
          // Only update sync intervals and file watching settings
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
      }
    })
  );

    // Check authentication status and prompt if needed
    if (!AuthService.isAuthenticated()) {
      // Show welcome message with options
      setTimeout(() => {
        vscode.window.showInformationMessage(
          'Cursor Chat Sync: Please login to start syncing',
          'Login',
          'Quick Setup',
          'Later'
        ).then((action) => {
          if (action === 'Login') {
            vscode.commands.executeCommand('cursorChatSync.login');
          } else if (action === 'Quick Setup') {
            vscode.commands.executeCommand('cursorChatSync.quickSetup');
          }
        });
      }, 2000); // Delay to let extension fully activate
    } else {
      const user = AuthService.getUser();
      vscode.window.showInformationMessage(
        `Cursor Chat Sync: Logged in as ${user?.name || user?.email || 'User'}`
      );
    }
  } catch (error: any) {
    console.error('Extension activation failed:', error);
    vscode.window.showErrorMessage(
      `Cursor Chat Sync: Activation failed. ${error.message}. Please check the output panel for details.`
    );
  }
}

export function deactivate() {
  if (syncManager) {
    syncManager.stopAutoSync();
    syncManager.dispose();
    syncManager = null;
  }
  if (fallbackStatusBar) {
    fallbackStatusBar.dispose();
    fallbackStatusBar = null;
  }
}
