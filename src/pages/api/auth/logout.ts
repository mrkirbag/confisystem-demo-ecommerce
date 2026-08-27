import type { APIRoute } from 'astro';
import { clearAdminSessionCookie } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
	clearAdminSessionCookie(cookies);

	const accept = request.headers.get('accept') ?? '';
	if (accept.includes('application/json')) {
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return redirect('/admin/login');
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
	clearAdminSessionCookie(cookies);
	return redirect('/admin/login');
};
