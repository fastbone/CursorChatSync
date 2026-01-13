import { Router, Response } from 'express';
import { z } from 'zod';
import pool from '../db/connection';
import authService from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  is_admin: z.boolean().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC'
    );
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await authService.register(data);
    res.status(201).json(user);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/admin', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const is_admin = req.body.is_admin === true;
    
    const result = await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, email, name, is_admin, created_at',
      [is_admin, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
