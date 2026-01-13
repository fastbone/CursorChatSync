import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../api/apiClient';
import { AuthService } from '../auth/authService';
import { DbReader } from './dbReader';
import { DbWriter } from './dbWriter';

export class SyncManager {
  private apiClient: ApiClient;
  private dbReader: DbReader;
  private dbWriter: DbWriter;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;
  private statusBarItem: vscode.StatusBarItem | null = null;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(apiUrl: string) {
    this.apiClient = new ApiClient(apiUrl);
    this.dbReader = new DbReader();
    this.dbWriter = new DbWriter();

    // Set token if available
    const token = AuthService.getToken();
    if (token) {
      this.apiClient.setToken(token);
    }

    // Initialize status bar
    this.initializeStatusBar();
  }

  private initializeStatusBar(): void {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'cursorChatSync.syncNow';
    this.statusBarItem.tooltip = 'Click to sync chat history';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  private updateStatusBar(): void {
    if (!this.statusBarItem) return;

    const isAuthenticated = AuthService.isAuthenticated();
    
    if (this.isSyncing) {
      this.statusBarItem.text = '$(sync~spin) Syncing...';
      this.statusBarItem.backgroundColor = undefined;
    } else if (!isAuthenticated) {
      this.statusBarItem.text = '$(sync-ignored) Chat Sync: Not logged in';
      this.statusBarItem.backgroundColor = undefined;
    } else if (this.lastSyncTime) {
      const timeAgo = this.getTimeAgo(this.lastSyncTime);
      this.statusBarItem.text = `$(check) Chat Sync: ${timeAgo}`;
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(sync) Chat Sync: Ready';
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  startFileWatching(debounceMs: number = 5000): void {
    this.stopFileWatching();
    
    if (!this.dbReader.exists()) {
      // File doesn't exist yet, try again later
      setTimeout(() => this.startFileWatching(debounceMs), 10000);
      return;
    }

    const dbPath = this.dbReader.getDbPath();
    const dbUri = vscode.Uri.file(dbPath);
    
    // Watch for changes to the state.vscdb file
    // VS Code file watchers can watch files outside workspace using absolute paths
    // We'll use a pattern that matches the file name in any location
    const fileName = path.basename(dbPath);
    const parentDir = path.dirname(dbPath);
    
    try {
      // Try to create a watcher using the parent directory and filename
      // VS Code's file watcher should handle absolute paths
      const pattern = new vscode.RelativePattern(parentDir, fileName);
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
      
      this.fileWatcher.onDidChange(() => {
        this.handleFileChange(debounceMs);
      });

      this.fileWatcher.onDidCreate(() => {
        this.handleFileChange(debounceMs);
      });
    } catch (error) {
      // If RelativePattern doesn't work, try with a glob pattern
      console.warn('File watcher with RelativePattern failed, trying glob pattern:', error);
      try {
        const globPattern = `**/${fileName}`;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(globPattern);
        
        this.fileWatcher.onDidChange((uri) => {
          if (uri.fsPath === dbPath) {
            this.handleFileChange(debounceMs);
          }
        });

        this.fileWatcher.onDidCreate((uri) => {
          if (uri.fsPath === dbPath) {
            this.handleFileChange(debounceMs);
          }
        });
      } catch (fallbackError) {
        console.warn('File watcher initialization failed completely:', fallbackError);
        // File watching will be disabled, but interval-based sync will still work
      }
    }
  }

  stopFileWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private handleFileChange(debounceMs: number): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Only sync if authenticated and not already syncing
    if (!AuthService.isAuthenticated() || this.isSyncing) {
      return;
    }

    // Debounce: wait before syncing
    this.debounceTimer = setTimeout(async () => {
      try {
        // Small delay to ensure file is fully written
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.syncNow();
      } catch (error: any) {
        // Silently handle errors for file watching (don't spam user)
        console.log('File watch sync failed:', error.message);
      }
    }, debounceMs);
  }

  dispose(): void {
    this.stopAutoSync();
    this.stopFileWatching();
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = null;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const response = await this.apiClient.login(email, password);
      AuthService.setToken(response.token);
      AuthService.setUser(response.user);
      this.apiClient.setToken(response.token);
      vscode.window.showInformationMessage('Successfully logged in to Chat Sync');
      return true;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Login failed: ${error.message}`);
      return false;
    }
  }

  logout(): void {
    AuthService.logout();
    this.apiClient.clearToken();
    this.stopAutoSync();
    this.updateStatusBar();
  }

  async syncNow(retryCount: number = 0): Promise<void> {
    if (this.isSyncing) {
      vscode.window.showInformationMessage('Sync already in progress...');
      return;
    }

    if (!AuthService.isAuthenticated()) {
      vscode.window.showErrorMessage('Please login first');
      return;
    }

    this.isSyncing = true;
    this.updateStatusBar();

    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    try {
      // Get current workspace
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      // Get git repo info
      const gitRepoUrl = await this.getGitRepoUrl(workspaceFolder.uri.fsPath);
      const gitRepoName = path.basename(workspaceFolder.uri.fsPath);

      // Read local chat history
      if (!this.dbReader.exists()) {
        throw new Error('state.vscdb not found. Make sure Cursor is installed.');
      }

      const localChatData = this.dbReader.readChatHistory();

      // Get or find project ID
      let projectId = AuthService.getProjectMapping(gitRepoUrl);
      
      // If no mapping exists, try to find project by repo URL
      if (!projectId) {
        const project = await this.apiClient.getProjectByRepoUrl(gitRepoUrl);
        if (project) {
          projectId = project.id;
          AuthService.setProjectMapping(gitRepoUrl, projectId);
        }
      }

      // Upload to server
      let uploadResponse;
      try {
        uploadResponse = await this.apiClient.uploadChat({
          git_repo_url: gitRepoUrl,
          git_repo_name: gitRepoName,
          chat_data: localChatData,
          workstation_id: this.getWorkstationId(),
        });
        
        // Store project mapping from upload response
        if (uploadResponse.project) {
          projectId = uploadResponse.project.id;
          AuthService.setProjectMapping(gitRepoUrl, projectId);
        }
      } catch (error: any) {
        if (error.response?.data?.requires_approval) {
          vscode.window.showWarningMessage(
            'Permission required. Request sent to admin for approval.'
          );
          return;
        }
        throw error;
      }

      // Download from server and merge
      if (projectId) {
        try {
          const remoteChat = await this.apiClient.downloadChat(projectId);
          if (remoteChat && remoteChat.chat_data) {
            // Merge remote and local chat data
            const merged = this.dbWriter.mergeChatHistory(remoteChat.chat_data, localChatData);
            
            // Write merged data back to local database
            this.dbWriter.writeChatHistory(merged);
            
            // If there were changes from remote, upload the merged version
            // This ensures both sides have the complete merged data
            if (JSON.stringify(merged) !== JSON.stringify(localChatData)) {
              await this.apiClient.uploadChat({
                git_repo_url: gitRepoUrl,
                git_repo_name: gitRepoName,
                chat_data: merged,
                workstation_id: this.getWorkstationId(),
              });
            }
          }
        } catch (error: any) {
          // If download fails (e.g., 404), that's okay - we've already uploaded
          // Log but don't fail the sync
          console.warn('Download failed (this is okay for first sync):', error.message);
        }
      }

      this.lastSyncTime = new Date();
      this.updateStatusBar();
      vscode.window.showInformationMessage('Chat history synced successfully');
    } catch (error: any) {
      // Retry logic for network errors
      const isNetworkError = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.response?.status >= 500 ||
        !error.response; // No response usually means network issue

      if (isNetworkError && retryCount < maxRetries) {
        this.isSyncing = false;
        this.updateStatusBar();
        
        vscode.window.showWarningMessage(
          `Sync failed (attempt ${retryCount + 1}/${maxRetries}): ${error.message}. Retrying...`
        );
        
        // Retry after delay
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.syncNow(retryCount + 1);
      }

      // Don't retry for permission errors or validation errors
      if (error.response?.data?.requires_approval) {
        this.isSyncing = false;
        this.updateStatusBar();
        vscode.window.showWarningMessage(
          'Permission required. Request sent to admin for approval.'
        );
        return;
      }

      this.updateStatusBar();
      const errorMessage = retryCount >= maxRetries 
        ? `Sync failed after ${maxRetries} attempts: ${error.message}`
        : `Sync failed: ${error.message}`;
      vscode.window.showErrorMessage(errorMessage);
    } finally {
      this.isSyncing = false;
      this.updateStatusBar();
    }
  }

  startAutoSync(intervalMs: number): void {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      this.syncNow().catch((error) => {
        console.error('Auto-sync error:', error);
      });
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  getStatus(): { isAuthenticated: boolean; lastSyncTime: Date | null; isSyncing: boolean } {
    return {
      isAuthenticated: AuthService.isAuthenticated(),
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
    };
  }

  private async getGitRepoUrl(workspacePath: string): Promise<string> {
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

    // Fallback: use workspace folder name
    return `file://${workspacePath}`;
  }

  private getWorkstationId(): string {
    // Generate a unique workstation ID based on machine info
    const os = require('os');
    return `${os.hostname()}-${os.userInfo().username}`;
  }
}
