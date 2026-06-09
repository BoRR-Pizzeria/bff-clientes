import type { APIRoute } from 'astro';
import { json } from '@/lib/http';

export const prerender = false;

export const GET: APIRoute = () => json({ ok: true, service: 'bffborr', ts: Date.now() });
