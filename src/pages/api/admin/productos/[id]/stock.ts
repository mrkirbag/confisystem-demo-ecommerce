import type { APIRoute } from 'astro';
import { ajustarStockProducto, getProductoById, toListado } from '@/lib/productos';
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

export const POST: APIRoute = async ({ params, request, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Producto no especificado.' }, 400);

	try {
		const body = (await request.json().catch(() => ({}))) as {
			tipo?: 'entrada' | 'salida';
			cantidad?: number;
			varianteId?: string;
			motivo?: string;
		};

		if (!body.tipo || (body.tipo !== 'entrada' && body.tipo !== 'salida')) {
			return json({ error: 'Tipo de ajuste inválido (debe ser entrada o salida).' }, 400);
		}

		const cantidad = Math.max(1, Math.round(Number(body.cantidad) || 0));
		if (cantidad <= 0) {
			return json({ error: 'La cantidad debe ser mayor a 0.' }, 400);
		}

		const actualizado = await ajustarStockProducto({
			productoId: id,
			varianteId: body.varianteId,
			tipo: body.tipo,
			cantidad,
			motivo: body.motivo,
			usuarioId: admin.id,
		});

		return json({
			ok: true,
			item: toListado(actualizado),
			producto: actualizado,
		});
	} catch (error) {
		console.error('Error ajustando stock:', error);
		const message = error instanceof Error ? error.message : 'No se pudo ajustar el stock.';
		return json({ error: message }, 400);
	}
};
