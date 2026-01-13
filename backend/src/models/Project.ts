export interface Project {
  id: number;
  git_repo_url: string;
  git_repo_name: string;
  owner_id: number;
  created_at: Date;
}

export interface CreateProjectInput {
  git_repo_url: string;
  git_repo_name: string;
  owner_id: number;
}

export interface ProjectResponse {
  id: number;
  git_repo_url: string;
  git_repo_name: string;
  owner_id: number;
  owner_name?: string;
  created_at: Date;
}
