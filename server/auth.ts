import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.ts';
import { forbidden, unauthorized } from './errors.ts';

export interface AuthUser {
  id: number;
  username: string;
  nama: string;
  peran: 'admin' | 'staf';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      nama: user.nama,
      peran: user.peran,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpires as jwt.SignOptions['expiresIn'] },
  );
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Token login tidak ditemukan. Silakan masuk terlebih dahulu.'));
  }

  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    if (!payload?.id || !payload?.peran) {
      return next(unauthorized());
    }
    req.user = {
      id: payload.id,
      username: payload.username,
      nama: payload.nama,
      peran: payload.peran,
    };
    next();
  } catch {
    next(unauthorized('Sesi Anda telah berakhir. Silakan masuk kembali.'));
  }
}

export function requireRole(...roles: Array<'admin' | 'staf'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized());
    }
    if (!roles.includes(req.user.peran)) {
      return next(forbidden('Aksi ini hanya diperbolehkan untuk Admin.'));
    }
    next();
  };
}
