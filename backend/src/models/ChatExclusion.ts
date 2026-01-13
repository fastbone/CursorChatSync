export interface ChatExclusion {
  id: number;
  user_id: number;
  project_id: number;
  conversation_id: string;
  created_at: Date;
}

export interface CreateExclusionInput {
  project_id: number;
  conversation_id: string;
}

export interface ExclusionResponse {
  id: number;
  project_id: number;
  conversation_id: string;
  created_at: Date;
}
