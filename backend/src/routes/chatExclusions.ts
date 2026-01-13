import { Router, Response } from 'express';
import { z } from 'zod';
import chatExclusionService from '../services/chatExclusionService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

const createExclusionSchema = z.object({
  project_id: z.number().int().positive(),
  conversation_id: z.string().min(1),
});

const removeExclusionSchema = z.object({
  project_id: z.number().int().positive(),
  conversation_id: z.string().min(1),
});

// Exclude conversation
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createExclusionSchema.parse(req.body);
    const userId = req.user!.id;

    const exclusion = await chatExclusionService.excludeConversation(userId, {
      project_id: data.project_id,
      conversation_id: data.conversation_id,
    });

    res.json(exclusion);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    res.status(400).json({ error: error.message });
  }
});

// Include conversation (remove exclusion)
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = removeExclusionSchema.parse(req.body);
    const userId = req.user!.id;

    await chatExclusionService.includeConversation(
      userId,
      data.project_id,
      data.conversation_id
    );

    res.json({ message: 'Exclusion removed successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    res.status(400).json({ error: error.message });
  }
});

// List exclusions
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;

    const exclusions = await chatExclusionService.getExclusions(userId, projectId);
    res.json(exclusions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
