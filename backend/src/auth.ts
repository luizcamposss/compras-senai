import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type UserRole = "professor" | "coordenacao";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const jwtSecret = () => process.env.JWT_SECRET ?? "dev-secret-change-me";

export function signToken(user: AuthUser) {
  return jwt.sign(user, jwtSecret(), { expiresIn: "8h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: "Autenticacao obrigatoria." });
    return;
  }

  try {
    req.user = jwt.verify(token, jwtSecret()) as AuthUser;
    next();
  } catch {
    res.status(401).json({ message: "Sessao invalida ou expirada." });
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ message: "Acesso negado para este perfil." });
      return;
    }

    next();
  };
}
