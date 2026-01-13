export interface ChatHistory {
  id: number;
  project_id: number;
  user_id: number;
  chat_data: any; // JSONB data
  last_synced_at: Date;
  workstation_id?: string;
  created_at: Date;
}

export interface UploadChatInput {
  project_id: number;
  chat_data: any;
  workstation_id?: string;
}

export interface ChatHistoryResponse {
  id: number;
  project_id: number;
  user_id: number;
  chat_data: any;
  last_synced_at: Date;
  workstation_id?: string;
  created_at: Date;
}
