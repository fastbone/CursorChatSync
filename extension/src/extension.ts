import * as vscode from 'vscode';
import { SyncManager } from './sync/syncManager';
import { AuthService } from './auth/authService';
import { registerCommands } from './commands/syncCommands';

let syncManager: SyncManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Set auth service context
  AuthService.context = context;

  // Get configuration
  const config = vscode.workspace.getConfiguration('cursorChatSync');
  const apiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api');
  const autoSyncInterval = config.get<number>('autoSyncInterval', 600000); // 10 minutes
  const enableAutoSync = config.get<boolean>('enableAutoSync', true);

  // Initialize sync manager
  syncManager = new SyncManager(apiUrl);

  // Register commands
  registerCommands(context, syncManager);

  // Start auto-sync if enabled
  if (enableAutoSync && AuthService.isAuthenticated()) {
    syncManager.startAutoSync(autoSyncInterval);
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cursorChatSync')) {
        const newConfig = vscode.workspace.getConfiguration('cursorChatSync');
        const newInterval = newConfig.get<number>('autoSyncInterval', 600000);
        const newEnableAutoSync = newConfig.get<boolean>('enableAutoSync', true);

        if (syncManager) {
          syncManager.stopAutoSync();
          if (newEnableAutoSync && AuthService.isAuthenticated()) {
            syncManager.startAutoSync(newInterval);
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
    syncManager = null;
  }
}
