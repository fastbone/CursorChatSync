import * as vscode from 'vscode';
import { SyncManager } from './sync/syncManager';
import { AuthService } from './auth/authService';
import { ApiClient } from './api/apiClient';
import { registerCommands } from './commands/syncCommands';
import { registerChatLockCommands } from './commands/chatLockCommands';
import { registerBackupCommands } from './commands/backupCommands';
import { registerContextMenuCommands } from './commands/contextMenuCommands';
import { ChatLockService } from './sync/chatLockService';
import { getActiveConversationDetector } from './utils/activeConversationDetector';

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

    // Register commands with callbacks to update global state
    const onSyncManagerCreated = (manager: SyncManager) => {
      syncManager = manager;
      // Dispose fallback status bar if it exists
      if (fallbackStatusBar) {
        fallbackStatusBar.dispose();
        fallbackStatusBar = null;
      }
    };
    
    const onFallbackStatusBarUpdate = (text: string, tooltip: string, command: string) => {
      if (fallbackStatusBar) {
        fallbackStatusBar.text = text;
        fallbackStatusBar.tooltip = tooltip;
        fallbackStatusBar.command = command;
      }
    };
    
    if (syncManager) {
      registerCommands(context, syncManager, onSyncManagerCreated, onFallbackStatusBarUpdate);
    } else {
      // Register commands with a null sync manager - they'll handle it gracefully
      registerCommands(context, null as any, onSyncManagerCreated, onFallbackStatusBarUpdate);
    }

    registerChatLockCommands(context, chatLockService, apiClientForCommands);
    
    // Register context menu commands
    registerContextMenuCommands(context, syncManager, chatLockService, apiClientForCommands);
    
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

    // Set up context tracking for authentication status
    updateAuthenticationContext();
    
    // Also update when auth state might change (on any config change)
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('cursorChatSync')) {
          updateAuthenticationContext();
        }
      })
    );

    // Update context immediately and periodically to ensure it's set
    const contextUpdateInterval = setInterval(() => {
      updateAuthenticationContext();
    }, 5000); // Update every 5 seconds
    context.subscriptions.push({
      dispose: () => clearInterval(contextUpdateInterval)
    });

    // Set up active conversation tracking
    setupActiveConversationTracking(context, syncManager);

    // Add test command to verify context variables
    const testContextCommand = vscode.commands.registerCommand('cursorChatSync.testContext', async () => {
      const isAuth = AuthService.isAuthenticated();
      try {
        const contextAuth = await vscode.commands.executeCommand('getContext', 'cursorChatSync.isAuthenticated');
        const activeConv = await vscode.commands.executeCommand('getContext', 'cursorChatSync.activeConversationId');
        
        vscode.window.showInformationMessage(
          `Auth Status: ${isAuth}\n` +
          `Context Auth: ${contextAuth}\n` +
          `Active Conversation: ${activeConv || 'None'}`
        );
      } catch (error) {
        vscode.window.showInformationMessage(`Auth Status: ${isAuth} (context check failed)`);
      }
    });
    context.subscriptions.push(testContextCommand);

    // Add quick actions status bar item for chat sync operations
    // This provides an alternative to context menu since Cursor's chat UI is a custom webview
    if (syncManager) {
      const quickActionsStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        99
      );
      quickActionsStatusBar.text = '$(sync) Chat Actions';
      quickActionsStatusBar.tooltip = 'Chat Sync Quick Actions';
      quickActionsStatusBar.command = 'cursorChatSync.showQuickActions';
      quickActionsStatusBar.show();
      context.subscriptions.push(quickActionsStatusBar);

      // Register quick actions command
      const quickActionsCommand = vscode.commands.registerCommand('cursorChatSync.showQuickActions', async () => {
        const actions = [
          { label: '$(sync) Sync This Chat', command: 'cursorChatSync.syncConversation' },
          { label: '$(lock) Lock This Chat', command: 'cursorChatSync.lockConversation' },
          { label: '$(unlock) Unlock This Chat', command: 'cursorChatSync.unlockConversation' },
          { label: '$(eye-closed) Exclude from Sync', command: 'cursorChatSync.excludeConversation' },
          { label: '$(eye) Include in Sync', command: 'cursorChatSync.includeConversation' },
        ];

        const selected = await vscode.window.showQuickPick(actions, {
          placeHolder: 'Select a chat sync action',
        });

        if (selected) {
          vscode.commands.executeCommand(selected.command);
        }
      });
      context.subscriptions.push(quickActionsCommand);
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

/**
 * Update VS Code context variables for authentication status
 */
function updateAuthenticationContext(): void {
  const isAuthenticated = AuthService.isAuthenticated();
  vscode.commands.executeCommand('setContext', 'cursorChatSync.isAuthenticated', isAuthenticated);
}

/**
 * Set up tracking for active conversation
 * Updates context when database changes are detected
 */
function setupActiveConversationTracking(
  context: vscode.ExtensionContext,
  syncManager: SyncManager | null
): void {
  let updateTimer: NodeJS.Timeout | null = null;
  const updateInterval = 3000; // Update every 3 seconds

  async function updateActiveConversation() {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspacePath = workspaceFolder?.uri.fsPath;
      
      if (!workspacePath) {
        vscode.commands.executeCommand('setContext', 'cursorChatSync.activeConversationId', undefined);
        return;
      }

      const detector = getActiveConversationDetector(workspacePath);
      const activeId = await detector.detectActiveConversation(workspacePath);
      
      if (activeId) {
        vscode.commands.executeCommand('setContext', 'cursorChatSync.activeConversationId', activeId);
      } else {
        vscode.commands.executeCommand('setContext', 'cursorChatSync.activeConversationId', undefined);
      }
    } catch (error: any) {
      // Silently handle errors - don't spam console
      console.debug('Failed to update active conversation:', error.message);
    }
  }

  // Initial update
  updateActiveConversation();

  // Set up periodic updates
  updateTimer = setInterval(updateActiveConversation, updateInterval);

  // Also update when database file changes (if file watching is enabled)
  if (syncManager) {
    // We'll hook into the file watcher's change detection
    // For now, the periodic update should be sufficient
  }

  // Clear interval on deactivation
  context.subscriptions.push({
    dispose: () => {
      if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
      }
    }
  });
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
  // Clear context variables
  vscode.commands.executeCommand('setContext', 'cursorChatSync.isAuthenticated', false);
  vscode.commands.executeCommand('setContext', 'cursorChatSync.activeConversationId', undefined);
}
