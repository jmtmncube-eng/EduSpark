import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  role: 'STUDENT' | 'TUTOR' | 'ADMIN' | 'PARENT';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prefer the Authorization header. Fall back to a `?token=` query param so
  // that browser-native requests that cannot set headers — <iframe src>,
  // <img src>, <a href target="_blank"> for streamed PDFs — still authenticate.
  const headerToken = req.headers.authorization?.split(' ')[1];
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = headerToken || queryToken;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'eduspark-secret') as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

export function adminOrTutorOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'TUTOR') {
    return res.status(403).json({ error: 'Teacher or admin access required' });
  }
  next();
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'eduspark-secret', { expiresIn: '7d' });
}
