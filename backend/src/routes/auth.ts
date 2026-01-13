import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import authService from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Async handler wrapper for Express 4
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  is_admin: z.boolean().optional(),
});

router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  let data;
  try {
    data = registerSchema.parse(req.body);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    throw error;
  }
  const user = await authService.register(data);
  res.status(201).json(user);
}));

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data.email, data.password);
  res.json(result);
}));

router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}));

export default router;
