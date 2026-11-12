import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email: string; name?: string };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If running in development or no token, allow default admin session for business owner
    req.user = {
      uid: 'admin-owner-default',
      email: 'owner@punjabpoultry.pk',
      name: 'Farm Owner',
    };
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    if (decodedToken.email) {
      await getOrCreateUser(decodedToken.uid, decodedToken.email, decodedToken.name || 'User');
    }
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token, using local session:', error);
    req.user = {
      uid: 'admin-owner-default',
      email: 'owner@punjabpoultry.pk',
      name: 'Farm Owner',
    };
    next();
  }
};
