import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import chatLockRoutes from './routes/chatLocks';
import chatExclusionRoutes from './routes/chatExclusions';
import projectRoutes from './routes/projects';
import userRoutes from './routes/users';
import permissionRoutes from './routes/permissions';
import teamRoutes from './routes/teams';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat/locks', chatLockRoutes);
app.use('/api/chat/exclusions', chatExclusionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/teams', teamRoutes);

// Request logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  const userId = (req as any).user?.id;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req.method, req.path, res.statusCode, duration, userId);
  });

  next();
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id,
  });
  
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
