import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import type { AdminSession } from '@/lib/auth';
import {
	getProductoById,
	knownProductoError,
	sanitizeProductoInput,
	setProductoActivo,
	slugEnUso,
	snapshotProducto,
	toListado,
	uniqueConstraintError,
	updateProducto,
	validateProductoInput,
} from '@/lib/productos';

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

export const GET: APIRoute = async ({ params, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const id = params.id;
	if (!id) return json({ error: 'Producto no encontrado.' }, 404);

	try {
		const item = await getProductoById(id);
		if (!item) return json({ error: 'Producto no encontrado.' }, 404);
		return json({ item });
	} catch (error) {
		console.error('Get producto error:', error);
		return json({ error: 'No se pudo cargar el producto.' }, 500);
	}
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Producto no encontrado.' }, 404);

	try {
		const current = await getProductoById(id);
		if (!current) return json({ error: 'Producto no encontrado.' }, 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeProductoInput(body);
		const error = validateProductoInput(input);
		if (error) return json({ error }, 400);

		if (await slugEnUso(input.slug, current.id)) {
			return json({ error: 'Ya existe un producto con ese slug.' }, 400);
		}

		const saved = await updateProducto(current.id, input);
		if (!saved) return json({ error: 'No se pudo guardar el producto.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'productos',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: {
				antes: snapshotProducto(current),
				despues: snapshotProducto(saved),
			},
		});

		return json({
			ok: true,
			item: toListado(saved),
		});
	} catch (error) {
		console.error('Update producto error:', error);
		const known = knownProductoError(error);
		if (known) return json({ error: known }, 400);
		if (uniqueConstraintError(error)) {
			const message = error instanceof Error ? error.message : String(error);
			if (/sku|idx_variantes_sku/i.test(message)) {
				return json({ error: 'Ya existe un producto con ese SKU.' }, 400);
			}
			return json({ error: 'Ya existe un producto con ese slug.' }, 400);
		}
		return json({ error: 'No se pudo guardar el producto.' }, 500);
	}
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Producto no encontrado.' }, 404);

	try {
		const current = await getProductoById(id);
		if (!current) return json({ error: 'Producto no encontrado.' }, 404);

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const activo = body.activo === true || body.activo === 1 || body.activo === '1' || body.activo === 'true';

		const saved = await setProductoActivo(current.id, activo);
		if (!saved) return json({ error: 'No se pudo actualizar el producto.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'productos',
			entidadId: saved.id,
			accion: activo ? 'activar' : 'eliminar',
			cambios: {
				antes: snapshotProducto(current),
				despues: snapshotProducto(saved),
			},
		});

		return json({
			ok: true,
			item: toListado(saved),
		});
	} catch (error) {
		console.error('Patch producto error:', error);
		return json({ error: 'No se pudo actualizar el producto.' }, 500);
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Producto no encontrado.' }, 404);

	try {
		const current = await getProductoById(id);
		if (!current) return json({ error: 'Producto no encontrado.' }, 404);

		if (!current.activo) {
			return json({ ok: true, item: toListado(current) });
		}

		const saved = await setProductoActivo(current.id, false);
		if (!saved) return json({ error: 'No se pudo desactivar el producto.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'productos',
			entidadId: saved.id,
			accion: 'eliminar',
			cambios: {
				antes: snapshotProducto(current),
				despues: snapshotProducto(saved),
			},
		});

		return json({
			ok: true,
			item: toListado(saved),
		});
	} catch (error) {
		console.error('Delete producto error:', error);
		return json({ error: 'No se pudo desactivar el producto.' }, 500);
	}
};
