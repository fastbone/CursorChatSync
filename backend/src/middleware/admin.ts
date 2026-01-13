import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}
