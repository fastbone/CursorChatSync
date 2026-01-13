export interface Permission {
  id: number;
  project_id: number;
  requester_id: number;
  approver_id?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

export interface CreatePermissionInput {
  project_id: number;
  requester_id: number;
}

export interface PermissionResponse {
  id: number;
  project_id: number;
  project_name?: string;
  requester_id: number;
  requester_name?: string;
  approver_id?: number;
  approver_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}
