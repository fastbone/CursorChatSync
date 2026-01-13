import { Router, Response } from 'express';
import { z } from 'zod';
import pool from '../db/connection';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

router.use(authMiddleware);

const createTeamSchema = z.object({
  name: z.string().min(1),
});

const addMemberSchema = z.object({
  user_id: z.number(),
  role: z.string().optional(),
});

// Get all teams (admin only)
router.get('/', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'user_id', tm.user_id,
                    'user_name', u.name,
                    'role', tm.role
                  )
                ) FILTER (WHERE tm.user_id IS NOT NULL),
                '[]'
              ) as members
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN users u ON tm.user_id = u.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create team (admin only)
router.post('/', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTeamSchema.parse(req.body);
    
    const result = await pool.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [data.name]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

// Add member to team (admin only)
router.post('/:id/members', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.id);
    const data = addMemberSchema.parse(req.body);
    
    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3
       RETURNING *`,
      [teamId, data.user_id, data.role || 'member']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

// Remove member from team (admin only)
router.delete('/:id/members/:userId', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    
    res.json({ message: 'Member removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
