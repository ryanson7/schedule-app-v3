//src/pages/api/_utils/ip.ts
import type { NextApiRequest } from 'next';

export function getClientIp(req: NextApiRequest): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length) {
    return xff[0].trim();
  }
  const ra = req.socket?.remoteAddress ?? null;
  return ra;
}
