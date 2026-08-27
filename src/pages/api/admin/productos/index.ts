import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	createProducto,
	knownProductoError,
	listProductos,
	sanitizeProductoInput,
	slugEnUso,
	snapshotProducto,
	toListado,
	uniqueConstraintError,
	validateProductoInput,
} from '@/lib/productos';

export const prerender = false;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const GET: APIRoute = async ({ locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const items = await listProductos();
		return json({ items });
	} catch (error) {
		console.error('List productos error:', error);
		return json({ error: 'No se pudieron cargar los productos.' }, 500);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeProductoInput(body);
		const error = validateProductoInput(input);
		if (error) return json({ error }, 400);

		if (await slugEnUso(input.slug)) {
			return json({ error: 'Ya existe un producto con ese slug.' }, 400);
		}

		const saved = await createProducto(input);
		if (!saved) return json({ error: 'No se pudo crear el producto.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'productos',
			entidadId: saved.id,
			accion: 'crear',
			cambios: { despues: snapshotProducto(saved) },
		});

		return json({
			ok: true,
			item: toListado(saved),
		});
	} catch (error) {
		console.error('Create producto error:', error);
		const known = knownProductoError(error);
		if (known) return json({ error: known }, 400);
		if (uniqueConstraintError(error)) {
			const message = error instanceof Error ? error.message : String(error);
			if (/sku|idx_variantes_sku/i.test(message)) {
				return json({ error: 'Ya existe un producto con ese SKU.' }, 400);
			}
			return json({ error: 'Ya existe un producto con ese slug.' }, 400);
		}
		return json({ error: 'No se pudo crear el producto.' }, 500);
	}
};
