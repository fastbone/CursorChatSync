import * as vscode from 'vscode';

export class AuthService {
  private static readonly TOKEN_KEY = 'cursorChatSync.token';
  private static readonly USER_KEY = 'cursorChatSync.user';

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
}
