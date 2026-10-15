import type { APIRoute } from 'astro';
import { listMovimientosStock } from '@/lib/productos';
import type { AdminSession } from '@/lib/auth';

export const prerender = false;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function guard(admin: AdminSession | null) {
	if (!admin) return json({ error: 'No autorizado' }, 401);
	return null;
}

export const GET: APIRoute = async ({ params, url, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const id = params.id;
	if (!id) return json({ error: 'Producto no especificado.' }, 400);

	try {
		const desde = url.searchParams.get('desde') || undefined;
		const hasta = url.searchParams.get('hasta') || undefined;
		const tipo = url.searchParams.get('tipo') || undefined;
		const varianteId = url.searchParams.get('varianteId') || undefined;

		const movimientos = await listMovimientosStock(id, {
			desde,
			hasta,
			tipo,
			varianteId,
		});

		return json({
			ok: true,
			movimientos,
		});
	} catch (error) {
		console.error('Error listando movimientos de stock:', error);
		const message = error instanceof Error ? error.message : 'No se pudo cargar el historial.';
		return json({ error: message }, 500);
	}
};
