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
const PORT = parseInt(process.env.PORT || '3000', 10);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', reason, { promise: String(promise) });
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  // Exit the process for uncaught exceptions as the application is in an undefined state
  process.exit(1);
});

// Async route handler wrapper to catch errors
const asyncHandler = (fn: Function) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(cors({
  origin: ['http://localhost', 'http://localhost:80', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Error handler for JSON parsing
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// Request logging middleware (before routes to catch all requests)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  const userId = (req as any).user?.id;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req.method, req.path, res.statusCode, duration, userId);
  });

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint
app.post('/api/test', asyncHandler(async (req: express.Request, res: express.Response) => {
  res.json({ received: req.body, message: 'Test endpoint works' });
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat/locks', chatLockRoutes);
app.use('/api/chat/exclusions', chatExclusionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/teams', teamRoutes);

// Error handling middleware (must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Don't log if response already sent
  if (res.headersSent) {
    return next(err);
  }

  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id,
  });

  // Handle Zod validation errors
  if (err.name === 'ZodError' || err.issues) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: err.errors || err.issues 
    });
  }

  // Handle known error types
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Something went wrong!';
  
  res.status(statusCode).json({ error: message });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server started on port ${PORT}`);
});

server.on('error', (error: any) => {
  logger.error('Server error', error);
});

server.on('close', () => {
  logger.warn('Server closed');
});
