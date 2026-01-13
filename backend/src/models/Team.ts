export interface Team {
  id: number;
  name: string;
  created_at: Date;
}

export interface TeamMember {
  team_id: number;
  user_id: number;
  role: string;
  created_at: Date;
}

export interface CreateTeamInput {
  name: string;
}

export interface TeamResponse {
  id: number;
  name: string;
  members?: Array<{
    user_id: number;
    user_name: string;
    role: string;
  }>;
  created_at: Date;
}
