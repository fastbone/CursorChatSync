import { Router, Response } from 'express';
import { z } from 'zod';
import chatLockService from '../services/chatLockService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

const createLockSchema = z.object({
  project_id: z.number().int().positive(),
  conversation_id: z.string().min(1),
  lock_type: z.enum(['auto', 'manual']),
  timeout_minutes: z.number().int().positive().optional(),
});

const unlockSchema = z.object({
  project_id: z.number().int().positive(),
  conversation_id: z.string().min(1),
});

const extendLockSchema = z.object({
  project_id: z.number().int().positive(),
  conversation_id: z.string().min(1),
  additional_minutes: z.number().int().positive(),
});

// Create lock (auto or manual)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createLockSchema.parse(req.body);
    const userId = req.user!.id;

    const lock = await chatLockService.lockChat(userId, {
      project_id: data.project_id,
      conversation_id: data.conversation_id,
      lock_type: data.lock_type,
      timeout_minutes: data.timeout_minutes,
    });

    res.json(lock);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    if (error.message.includes('already locked')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(400).json({ error: error.message });
  }
});

// Remove lock
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = unlockSchema.parse(req.body);
    const userId = req.user!.id;

    await chatLockService.unlockChat(userId, data.project_id, data.conversation_id);

    res.json({ message: 'Lock removed successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    res.status(400).json({ error: error.message });
  }
});

// Get lock status
router.get('/:projectId/:conversationId', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const conversationId = req.params.conversationId;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project_id' });
    }

    const lockInfo = await chatLockService.getLockInfo(projectId, conversationId);
    res.json(lockInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Extend lock timeout
router.post('/extend', async (req: AuthRequest, res: Response) => {
  try {
    const data = extendLockSchema.parse(req.body);
    const userId = req.user!.id;

    const lock = await chatLockService.extendLock(userId, {
      project_id: data.project_id,
      conversation_id: data.conversation_id,
      additional_minutes: data.additional_minutes,
    });

    res.json(lock);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    res.status(400).json({ error: error.message });
  }
});

// Get user's locks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;

    const locks = await chatLockService.getUserLocks(userId, projectId);
    res.json(locks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
