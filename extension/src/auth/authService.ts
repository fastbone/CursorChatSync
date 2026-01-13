import * as vscode from 'vscode';

export class AuthService {
  private static readonly TOKEN_KEY = 'cursorChatSync.token';
  private static readonly USER_KEY = 'cursorChatSync.user';
  private static readonly PROJECT_MAPPING_KEY = 'cursorChatSync.projectMappings';

  // Set context from extension activation
  static context: vscode.ExtensionContext | null = null;

  private static getContext(): vscode.ExtensionContext {
    if (!this.context) {
      throw new Error('Extension context not initialized. Call AuthService.context = context in activate()');
    }
    return this.context;
  }

  static getToken(): string | null {
    return this.getContext().globalState.get<string>(this.TOKEN_KEY) || null;
  }

  static setToken(token: string): void {
    this.getContext().globalState.update(this.TOKEN_KEY, token);
  }

  static clearToken(): void {
    this.getContext().globalState.update(this.TOKEN_KEY, undefined);
  }

  static getUser(): any | null {
    return this.getContext().globalState.get<any>(this.USER_KEY) || null;
  }

  static setUser(user: any): void {
    this.getContext().globalState.update(this.USER_KEY, user);
  }

  static clearUser(): void {
    this.getContext().globalState.update(this.USER_KEY, undefined);
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  static logout(): void {
    this.clearToken();
    this.clearUser();
    vscode.window.showInformationMessage('Logged out from Chat Sync');
  }

  static getProjectMapping(gitRepoUrl: string): number | null {
    const mappings = this.getContext().globalState.get<Record<string, number>>(this.PROJECT_MAPPING_KEY) || {};
    return mappings[gitRepoUrl] || null;
  }

  static setProjectMapping(gitRepoUrl: string, projectId: number): void {
    const mappings = this.getContext().globalState.get<Record<string, number>>(this.PROJECT_MAPPING_KEY) || {};
    mappings[gitRepoUrl] = projectId;
    this.getContext().globalState.update(this.PROJECT_MAPPING_KEY, mappings);
  }

  static clearProjectMappings(): void {
    this.getContext().globalState.update(this.PROJECT_MAPPING_KEY, undefined);
  }
}
