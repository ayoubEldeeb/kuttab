import type { PrismaClient } from '@prisma/client';

/**
 * Reads the signed-in sheikh's id from the request, either from the
 * `x-sheikh-id` header or from the `Bearer shk_<id>_...` token the login returns.
 */
export function extractSheikhId(authHeader?: string, headerId?: string): number | null {
  if (headerId) {
    const parsed = parseInt(headerId, 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const parts = token.split('_');
    if (parts[0] === 'shk' && parts[1]) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

export function isAdminSheikh(sheikh: { role?: string | null; username?: string | null } | null | undefined): boolean {
  return sheikh?.role === 'مشرف عام' || sheikh?.username === 'admin';
}

export interface Caller {
  id: number;
  name: string;
  role: string;
  username: string | null;
  isAdmin: boolean;
}

/** Resolves the signed-in, active sheikh behind a request, or null. */
export async function getCaller(prisma: PrismaClient, authHeader?: string, headerId?: string): Promise<Caller | null> {
  const id = extractSheikhId(authHeader, headerId);
  if (!id) return null;
  const s = await prisma.sheikh.findUnique({ where: { id } });
  if (!s || !s.isActive) return null;
  return { id: s.id, name: s.name, role: s.role, username: s.username, isAdmin: isAdminSheikh(s) };
}
