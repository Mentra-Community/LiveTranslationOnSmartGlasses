import express, { Request, Response } from 'express';

export const router = express.Router();

async function healthCheck(req: Request, res: Response) {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    app: process.env.PACKAGE_NAME || 'live-translation'
  });
}

// Routes
router.get('/health', healthCheck);