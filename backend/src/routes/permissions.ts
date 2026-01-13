import { Router, Response } from 'express';
import permissionService from '../services/permissionService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

router.use(authMiddleware);

// Get pending permissions (admin only)
router.get('/pending', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await permissionService.getPendingPermissions();
    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all permissions (admin only)
router.get('/', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await permissionService.getAllPermissions();
    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve permission (admin only)
router.post('/:id/approve', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const approverId = req.user!.id;
    
    const permission = await permissionService.approvePermission(id, approverId);
    res.json(permission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Reject permission (admin only)
router.post('/:id/reject', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const approverId = req.user!.id;
    
    const permission = await permissionService.rejectPermission(id, approverId);
    res.json(permission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
