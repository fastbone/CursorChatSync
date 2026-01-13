import * as vscode from 'vscode';
import { SyncManager } from '../sync/syncManager';
import { AuthService } from '../auth/authService';
import { logger } from '../utils/logger';

export function registerCommands(
  context: vscode.ExtensionContext,
  syncManager: SyncManager
) {
  // Login command
  const loginCommand = vscode.commands.registerCommand('cursorChatSync.login', async () => {
    const email = await vscode.window.showInputBox({
      prompt: 'Enter your email',
      placeHolder: 'user@example.com',
    });

    if (!email) {
      return;
    }

    const password = await vscode.window.showInputBox({
      prompt: 'Enter your password',
      placeHolder: 'Password',
      password: true,
    });

    if (!password) {
      return;
    }

    await syncManager.login(email, password);
  });

  // Logout command
  const logoutCommand = vscode.commands.registerCommand('cursorChatSync.logout', () => {
    syncManager.logout();
  });

  // Sync now command
  const syncNowCommand = vscode.commands.registerCommand('cursorChatSync.syncNow', async () => {
    await syncManager.syncNow();
  });

  // Status command
  const statusCommand = vscode.commands.registerCommand('cursorChatSync.status', () => {
    const status = syncManager.getStatus();
    const user = AuthService.getUser();
    
    const message = [
      `Status: ${status.isAuthenticated ? 'Authenticated' : 'Not authenticated'}`,
      user ? `User: ${user.name} (${user.email})` : 'User: Not logged in',
      status.lastSyncTime
        ? `Last sync: ${status.lastSyncTime.toLocaleString()}`
        : 'Last sync: Never',
      `Syncing: ${status.isSyncing ? 'Yes' : 'No'}`,
    ].join('\n');

    vscode.window.showInformationMessage(message);
  });

  // Settings command
  const settingsCommand = vscode.commands.registerCommand('cursorChatSync.settings', async () => {
    const config = vscode.workspace.getConfiguration('cursorChatSync');
    const currentApiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api');
    const currentAutoSync = config.get<boolean>('enableAutoSync', true);
    const currentAutoSyncInterval = config.get<number>('autoSyncInterval', 600000);
    const currentFileWatching = config.get<boolean>('enableFileWatching', true);
    const currentFileWatchDebounce = config.get<number>('fileWatchDebounce', 5000);

    // Show current settings
    const settingsInfo = [
      `Current Settings:`,
      `API URL: ${currentApiUrl}`,
      `Auto Sync: ${currentAutoSync ? 'Enabled' : 'Disabled'}`,
      `Auto Sync Interval: ${currentAutoSyncInterval / 1000 / 60} minutes`,
      `File Watching: ${currentFileWatching ? 'Enabled' : 'Disabled'}`,
      `File Watch Debounce: ${currentFileWatchDebounce / 1000} seconds`,
      ``,
      `Would you like to:`,
      `1. Change API URL`,
      `2. Test Connection`,
      `3. Open Settings`,
    ].join('\n');

    const action = await vscode.window.showInformationMessage(
      settingsInfo,
      { modal: true },
      'Change API URL',
      'Test Connection',
      'Open Settings'
    );

    if (action === 'Change API URL') {
      const newApiUrl = await vscode.window.showInputBox({
        prompt: 'Enter new API URL',
        value: currentApiUrl,
        placeHolder: 'http://localhost:3000/api',
        validateInput: (value) => {
          try {
            new URL(value);
            return null;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      });

      if (newApiUrl) {
        await config.update('apiUrl', newApiUrl, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`API URL updated to: ${newApiUrl}`);
        vscode.window.showWarningMessage('Please restart the extension for changes to take effect.');
      }
    } else if (action === 'Test Connection') {
      try {
        const response = await fetch(`${currentApiUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          vscode.window.showInformationMessage('✓ Connection successful!');
        } else {
          vscode.window.showWarningMessage(`Connection failed: ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
      }
    } else if (action === 'Open Settings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:cursorChatSync');
    }
  });

  context.subscriptions.push(loginCommand, logoutCommand, syncNowCommand, statusCommand, settingsCommand);
}
