import { defineMiddleware } from 'astro:middleware';
import { getAdminFromCookies } from './lib/auth';

function isPublicAdminPath(pathname: string) {
	return pathname === '/admin/login' || pathname === '/admin/login/';
}

function requiresAdmin(pathname: string) {
	if (pathname.startsWith('/admin')) {
		return !isPublicAdminPath(pathname);
	}
	return pathname.startsWith('/api/admin');
}

export const onRequest = defineMiddleware(async (context, next) => {
	const admin = await getAdminFromCookies(context.cookies);
	context.locals.admin = admin;

	const { pathname } = context.url;

	if (requiresAdmin(pathname) && !admin) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'No autorizado' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const redirectTo = encodeURIComponent(pathname + context.url.search);
		return context.redirect(`/admin/login?next=${redirectTo}`);
	}

	if (isPublicAdminPath(pathname) && admin) {
		return context.redirect('/admin');
	}

	return next();
});
