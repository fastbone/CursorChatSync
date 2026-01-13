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
}

export interface ProjectInfo {
  id: number;
  git_repo_url: string;
  git_repo_name: string;
  owner_id: number;
  created_at: string;
  can_sync?: boolean;
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
}
