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
