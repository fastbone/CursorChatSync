import { Router, Response } from 'express';
import { z } from 'zod';
import chatService from '../services/chatService';
import projectService from '../services/projectService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

const uploadChatSchema = z.object({
  git_repo_url: z.string().url(),
  git_repo_name: z.string().min(1),
  chat_data: z.any(),
  workstation_id: z.string().optional(),
});

router.post('/upload', async (req: AuthRequest, res: Response) => {
  try {
    const data = uploadChatSchema.parse(req.body);
    const userId = req.user!.id;
    
    // Find or create project
    const project = await projectService.findOrCreateProject(
      data.git_repo_url,
      data.git_repo_name,
      userId
    );
    
    // Upload chat
    const chatHistory = await chatService.uploadChat(userId, {
      project_id: project.id,
      chat_data: data.chat_data,
      workstation_id: data.workstation_id,
    });
    
    res.json(chatHistory);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    if (error.message.includes('Permission required')) {
      return res.status(403).json({ error: error.message, requires_approval: true });
    }
    
    res.status(400).json({ error: error.message });
  }
});

router.get('/download', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.query.project_id as string);
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    
    const userId = req.user!.id;
    const chatHistory = await chatService.downloadChat(userId, projectId);
    
    if (!chatHistory) {
      return res.status(404).json({ error: 'Chat history not found' });
    }
    
    res.json(chatHistory);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
    
    const history = await chatService.getChatHistory(userId, projectId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
