export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  is_admin: boolean;
  created_at: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  is_admin?: boolean;
}

export interface UserResponse {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  created_at: Date;
}
