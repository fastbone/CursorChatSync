export type LockType = 'auto' | 'manual';

export interface ChatLock {
  id: number;
  project_id: number;
  conversation_id: string;
  locked_by_user_id: number;
  lock_type: LockType;
  expires_at: Date | null;
  created_at: Date;
}

export interface CreateLockInput {
  project_id: number;
  conversation_id: string;
  lock_type: LockType;
  timeout_minutes?: number; // Only for auto locks
}

export interface LockInfo {
  is_locked: boolean;
  locked_by_user_id?: number;
  locked_by_user_name?: string;
  lock_type?: LockType;
  expires_at?: Date | null;
  created_at?: Date;
}

export interface ExtendLockInput {
  project_id: number;
  conversation_id: string;
  additional_minutes: number;
}
