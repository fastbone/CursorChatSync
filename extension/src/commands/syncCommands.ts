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
        vscode.window.showInformationMessage(`✓ API URL updated to: ${newApiUrl}\nChanges take effect immediately.`);
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

  // Quick setup command
  const quickSetupCommand = vscode.commands.registerCommand('cursorChatSync.quickSetup', async () => {
    const config = vscode.workspace.getConfiguration('cursorChatSync');
    const currentApiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api');

    // Show welcome message
    const welcomeMessage = await vscode.window.showInformationMessage(
      'Welcome to Cursor Chat Sync Quick Setup!\n\nThis will help you configure the server address.',
      { modal: true },
      'Start Setup'
    );

    if (!welcomeMessage) {
      return;
    }

    // Preset options
    const presetOptions = [
      { label: 'Local Development', value: 'http://localhost:3000/api', description: 'For local development' },
      { label: 'Custom URL', value: 'custom', description: 'Enter a custom server URL' },
    ];

    const preset = await vscode.window.showQuickPick(presetOptions, {
      placeHolder: 'Select a server preset or choose custom',
      ignoreFocusOut: true,
    });

    if (!preset) {
      return;
    }

    let apiUrl: string | undefined;

    if (preset.value === 'custom') {
      apiUrl = await vscode.window.showInputBox({
        prompt: 'Enter your Chat Sync server URL',
        value: currentApiUrl,
        placeHolder: 'https://your-server.com/api',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'URL cannot be empty';
          }
          try {
            const url = new URL(value);
            if (!url.protocol.startsWith('http')) {
              return 'URL must start with http:// or https://';
            }
            return null;
          } catch {
            return 'Please enter a valid URL (e.g., https://example.com/api)';
          }
        },
        ignoreFocusOut: true,
      });
    } else {
      apiUrl = preset.value;
    }

    if (!apiUrl) {
      return;
    }

    // Test connection
    const testConnection = await vscode.window.showInformationMessage(
      `Server URL: ${apiUrl}\n\nWould you like to test the connection?`,
      { modal: true },
      'Test Connection',
      'Skip Test'
    );

    if (testConnection === 'Test Connection') {
      vscode.window.showInformationMessage('Testing connection...');
      try {
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          vscode.window.showInformationMessage('✓ Connection successful!');
        } else {
          const proceed = await vscode.window.showWarningMessage(
            `Connection test failed: ${response.status} ${response.statusText}\n\nDo you want to save this URL anyway?`,
            { modal: true },
            'Save Anyway',
            'Cancel'
          );
          if (proceed !== 'Save Anyway') {
            return;
          }
        }
      } catch (error: any) {
        const proceed = await vscode.window.showWarningMessage(
          `Connection test failed: ${error.message}\n\nDo you want to save this URL anyway?`,
          { modal: true },
          'Save Anyway',
          'Cancel'
        );
        if (proceed !== 'Save Anyway') {
          return;
        }
      }
    }

    // Save configuration
    await config.update('apiUrl', apiUrl, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `✓ Server URL configured: ${apiUrl}\n\nYou can now login using the "Login to Chat Sync" command.`,
      { modal: true }
    );
  });

  context.subscriptions.push(loginCommand, logoutCommand, syncNowCommand, statusCommand, settingsCommand, quickSetupCommand);
}
