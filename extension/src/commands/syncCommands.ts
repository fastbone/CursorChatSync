import * as vscode from 'vscode';
import { SyncManager } from '../sync/syncManager';
import { AuthService } from '../auth/authService';

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

  context.subscriptions.push(loginCommand, logoutCommand, syncNowCommand, statusCommand);
}
