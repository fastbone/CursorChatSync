import { Router, Response } from 'express';
import { z } from 'zod';
import projectService from '../services/projectService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

router.use(authMiddleware);

const createProjectSchema = z.object({
  git_repo_url: z.string().url(),
  git_repo_name: z.string().min(1),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.is_admin;
    
    let projects;
    if (isAdmin) {
      projects = await projectService.getAllProjects();
    } else {
      projects = await projectService.getProjectsByOwner(userId);
    }
    
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const project = await projectService.getProjectById(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const userId = req.user!.id;
    
    const project = await projectService.createProject({
      ...data,
      owner_id: userId,
    });
    
    res.status(201).json(project);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
