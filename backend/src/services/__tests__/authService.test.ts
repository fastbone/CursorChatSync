import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import authService from '../authService';
import pool from '../../db/connection';

// Mock dependencies
jest.mock('../../db/connection', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    logAuth: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockPool = pool as any;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const input = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        is_admin: false,
      };

      // Mock: user doesn't exist
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock: insert user
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: input.email,
          name: input.name,
          is_admin: false,
          created_at: new Date(),
        }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await authService.register(input);

      expect(result).toMatchObject({
        id: 1,
        email: input.email,
        name: input.name,
        is_admin: false,
      });
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user already exists', async () => {
      const input = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Mock: user exists
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await expect(authService.register(input)).rejects.toThrow('User with this email already exists');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should hash password before storing', async () => {
      const input = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as any);

      const hashSpy = jest.spyOn(bcrypt, 'hash');
      hashSpy.mockResolvedValueOnce('hashed_password' as never);

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: input.email,
          name: input.name,
          is_admin: false,
          created_at: new Date(),
        }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      } as any);

      await authService.register(input);

      expect(hashSpy).toHaveBeenCalledWith('password123', 10);
      hashSpy.mockRestore();
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      // Mock: user exists
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          email,
          password_hash: hashedPassword,
          name: 'Test User',
          is_admin: false,
          created_at: new Date(),
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await authService.login(email, password);

      expect(result.user).toMatchObject({
        id: 1,
        email,
        name: 'Test User',
        is_admin: false,
      });
      expect(result.token).toBeDefined();
      
      // Verify token is valid JWT
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET || 'test-secret-key') as any;
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe(email);
    });

    it('should throw error for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as any);

      await expect(authService.login('nonexistent@example.com', 'password')).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      const email = 'test@example.com';
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          email,
          password_hash: hashedPassword,
          name: 'Test User',
          is_admin: false,
          created_at: new Date(),
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await expect(authService.login(email, 'wrongpassword')).rejects.toThrow('Invalid email or password');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const payload = { id: 1, email: 'test@example.com', is_admin: false };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key', { expiresIn: '1h' });

      const result = await authService.verifyToken(token);

      expect(result).toMatchObject({
        id: 1,
        email: 'test@example.com',
        is_admin: false,
      });
    });

    it('should throw error for invalid token', async () => {
      await expect(authService.verifyToken('invalid-token')).rejects.toThrow('Invalid or expired token');
    });

    it('should throw error for expired token', async () => {
      const payload = { id: 1, email: 'test@example.com', is_admin: false };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key', { expiresIn: '-1h' });

      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          is_admin: false,
          created_at: new Date(),
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await authService.getUserById(1);

      expect(result).toMatchObject({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        is_admin: false,
      });
    });

    it('should return null when user not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as any);

      const result = await authService.getUserById(999);

      expect(result).toBeNull();
    });
  });
});
