import axios, { AxiosInstance } from 'axios';

export interface LoginResponse {
  user: {
    id: number;
    email: string;
    name: string;
    is_admin: boolean;
  };
  token: string;
}

export interface UploadChatRequest {
  git_repo_url: string;
  git_repo_name: string;
  chat_data: any;
  workstation_id?: string;
}

export interface ChatHistoryResponse {
  id: number;
  project_id: number;
  user_id: number;
  chat_data: any;
  last_synced_at: string;
  workstation_id?: string;
  created_at?: string;
}

export interface UploadChatResponse extends ChatHistoryResponse {
  project: {
    id: number;
    git_repo_url: string;
    git_repo_name: string;
  };
  locked_conversations?: string[];
  lock_warning?: string;
}

export interface ProjectInfo {
  id: number;
  git_repo_url: string;
  git_repo_name: string;
  owner_id: number;
  created_at: string;
  can_sync?: boolean;
}

export interface CreateLockRequest {
  project_id: number;
  conversation_id: string;
  lock_type: 'auto' | 'manual';
  timeout_minutes?: number;
}

export interface LockInfo {
  is_locked: boolean;
  locked_by_user_id?: number;
  locked_by_user_name?: string;
  lock_type?: 'auto' | 'manual';
  expires_at?: string | null;
  created_at?: string;
}

export interface RemoveLockRequest {
  project_id: number;
  conversation_id: string;
}

export interface ExclusionRequest {
  project_id: number;
  conversation_id: string;
}

export interface ExclusionResponse {
  id: number;
  project_id: number;
  conversation_id: string;
  created_at: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async uploadChat(data: UploadChatRequest): Promise<UploadChatResponse> {
    const response = await this.client.post<UploadChatResponse>('/chat/upload', data);
    return response.data;
  }

  async getProjectByRepoUrl(gitRepoUrl: string): Promise<ProjectInfo | null> {
    try {
      const response = await this.client.get<ProjectInfo>('/chat/project', {
        params: { git_repo_url: gitRepoUrl },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async downloadChat(projectId: number): Promise<ChatHistoryResponse | null> {
    try {
      const response = await this.client.get<ChatHistoryResponse>('/chat/download', {
        params: { project_id: projectId },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getChatHistory(projectId?: number): Promise<ChatHistoryResponse[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await this.client.get<ChatHistoryResponse[]>('/chat/history', {
      params,
    });
    return response.data;
  }

  // Lock methods
  async createLock(data: CreateLockRequest): Promise<any> {
    const response = await this.client.post('/chat/locks', data);
    return response.data;
  }

  async removeLock(data: RemoveLockRequest): Promise<void> {
    await this.client.delete('/chat/locks', { data });
  }

  async getLockStatus(projectId: number, conversationId: string): Promise<LockInfo> {
    const response = await this.client.get<LockInfo>(
      `/chat/locks/${projectId}/${encodeURIComponent(conversationId)}`
    );
    return response.data;
  }

  async extendLock(
    projectId: number,
    conversationId: string,
    additionalMinutes: number
  ): Promise<any> {
    const response = await this.client.post('/chat/locks/extend', {
      project_id: projectId,
      conversation_id: conversationId,
      additional_minutes: additionalMinutes,
    });
    return response.data;
  }

  // Exclusion methods
  async excludeConversation(data: ExclusionRequest): Promise<ExclusionResponse> {
    const response = await this.client.post<ExclusionResponse>('/chat/exclusions', data);
    return response.data;
  }

  async includeConversation(data: ExclusionRequest): Promise<void> {
    await this.client.delete('/chat/exclusions', { data });
  }

  async getExclusions(projectId?: number): Promise<ExclusionResponse[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await this.client.get<ExclusionResponse[]>('/chat/exclusions', {
      params,
    });
    return response.data;
  }
}
