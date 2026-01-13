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

  constructor(apiUrl: string) {
    this.apiClient = new ApiClient(apiUrl);
    this.dbReader = new DbReader();
    this.dbWriter = new DbWriter();

    // Set token if available
    const token = AuthService.getToken();
    if (token) {
      this.apiClient.setToken(token);
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
  }

  async syncNow(): Promise<void> {
    if (this.isSyncing) {
      vscode.window.showInformationMessage('Sync already in progress...');
      return;
    }

    if (!AuthService.isAuthenticated()) {
      vscode.window.showErrorMessage('Please login first');
      return;
    }

    this.isSyncing = true;
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(sync~spin) Syncing...';
    statusBar.show();

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

      // Upload to server
      try {
        await this.apiClient.uploadChat({
          git_repo_url: gitRepoUrl,
          git_repo_name: gitRepoName,
          chat_data: localChatData,
          workstation_id: this.getWorkstationId(),
        });
      } catch (error: any) {
        if (error.response?.data?.requires_approval) {
          vscode.window.showWarningMessage(
            'Permission required. Request sent to admin for approval.'
          );
          return;
        }
        throw error;
      }

      // Download from server
      // Note: We'd need project_id for this, which we get from the upload response
      // For now, we'll skip the download step and just upload
      // In a full implementation, you'd store the project_id and use it for downloads

      this.lastSyncTime = new Date();
      vscode.window.showInformationMessage('Chat history synced successfully');
    } catch (error: any) {
      vscode.window.showErrorMessage(`Sync failed: ${error.message}`);
    } finally {
      this.isSyncing = false;
      statusBar.dispose();
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
