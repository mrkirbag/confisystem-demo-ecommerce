import type { APIRoute } from 'astro';
import {
	authenticateAdmin,
	setAdminSessionCookie,
	signAdminToken,
} from '@/lib/auth';

export const prerender = false;

function wantsJson(request: Request) {
	const accept = request.headers.get('accept') ?? '';
	const contentType = request.headers.get('content-type') ?? '';
	return accept.includes('application/json') || contentType.includes('application/json');
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	try {
		let correo = '';
		let password = '';
		let next = '/admin';

		const contentType = request.headers.get('content-type') ?? '';
		if (contentType.includes('application/json')) {
			let body: {
				correo?: string;
				password?: string;
				next?: string;
			};

			try {
				body = (await request.json()) as typeof body;
			} catch {
				return new Response(JSON.stringify({ error: 'JSON inválido' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			correo = body.correo?.trim() ?? '';
			password = body.password ?? '';
			if (body.next?.startsWith('/')) next = body.next;
		} else {
			const form = await request.formData();
			correo = String(form.get('correo') ?? '').trim();
			password = String(form.get('password') ?? '');
			const formNext = String(form.get('next') ?? '');
			if (formNext.startsWith('/')) next = formNext;
		}

		if (!correo || !password) {
			if (wantsJson(request)) {
				return new Response(JSON.stringify({ error: 'Correo y contraseña son obligatorios' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return redirect('/admin/login?error=missing');
		}

		const admin = await authenticateAdmin(correo, password);
		if (!admin) {
			if (wantsJson(request)) {
				return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return redirect('/admin/login?error=invalid');
		}

		const token = await signAdminToken(admin);
		setAdminSessionCookie(cookies, token);

		if (wantsJson(request)) {
			return new Response(JSON.stringify({ ok: true, redirect: next }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return redirect(next);
	} catch (error) {
		console.error('Login error:', error);
		if (wantsJson(request)) {
			return new Response(JSON.stringify({ error: 'Error interno al iniciar sesión' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return redirect('/admin/login?error=server');
	}
};
