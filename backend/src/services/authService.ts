import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import pool from '../db/connection';
import { User, CreateUserInput, UserResponse } from '../models/User';
import { logger } from '../utils/logger';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  async register(input: CreateUserInput): Promise<UserResponse> {
    const { email, password, name, is_admin } = input;
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      logger.logAuth('register', undefined, false, 'Email already exists');
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, is_admin, created_at`,
      [email, password_hash, name, is_admin || false]
    );
    
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      created_at: user.created_at,
    };
  }
  
  async login(email: string, password: string): Promise<{ user: UserResponse; token: string }> {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, is_admin, created_at FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      logger.logAuth('login', undefined, false, 'User not found');
      throw new Error('Invalid email or password');
    }
    
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      logger.logAuth('login', user.id, false, 'Invalid password');
      throw new Error('Invalid email or password');
    }
    
    logger.logAuth('login', user.id, true);
    
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin,
        created_at: user.created_at,
      },
      token,
    };
  }
  
  async verifyToken(token: string): Promise<{ id: number; email: string; is_admin: boolean }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        id: decoded.id,
        email: decoded.email,
        is_admin: decoded.is_admin,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
  
  async getUserById(id: number): Promise<UserResponse | null> {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, created_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      created_at: user.created_at,
    };
  }
}

export default new AuthService();
