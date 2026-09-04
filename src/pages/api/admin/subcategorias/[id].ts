import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import type { AdminSession } from '@/lib/auth';
import {
	countProductosBySubcategoria,
	getSubcategoriaById,
	knownSubcategoriaError,
	sanitizeSubcategoriaInput,
	setSubcategoriaActivo,
	slugEnUso,
	snapshotSubcategoria,
	uniqueConstraintError,
	updateSubcategoria,
	validateSubcategoriaInput,
} from '@/lib/subcategorias';

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

export const PUT: APIRoute = async ({ params, request, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Subcategoría no encontrada.' }, 404);

	try {
		const current = await getSubcategoriaById(id);
		if (!current) return json({ error: 'Subcategoría no encontrada.' }, 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeSubcategoriaInput(body);
		const error = validateSubcategoriaInput(input);
		if (error) return json({ error }, 400);

		if (await slugEnUso(input.slug, input.categoria_id, current.id)) {
			return json({ error: 'Ya existe una subcategoría con ese slug en esta categoría.' }, 400);
		}

		const saved = await updateSubcategoria(current.id, input);
		if (!saved) return json({ error: 'No se pudo guardar la subcategoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'subcategorias',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: {
				antes: snapshotSubcategoria(current),
				despues: snapshotSubcategoria(saved),
			},
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Update subcategoria error:', error);
		const known = knownSubcategoriaError(error);
		if (known) return json({ error: known }, 400);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe una subcategoría con ese slug en esta categoría.' }, 400);
		}
		return json({ error: 'No se pudo guardar la subcategoría.' }, 500);
	}
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Subcategoría no encontrada.' }, 404);

	try {
		const current = await getSubcategoriaById(id);
		if (!current) return json({ error: 'Subcategoría no encontrada.' }, 404);

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const activo = body.activo === true || body.activo === 1 || body.activo === '1' || body.activo === 'true';

		const saved = await setSubcategoriaActivo(current.id, activo);
		if (!saved) return json({ error: 'No se pudo actualizar la subcategoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'subcategorias',
			entidadId: saved.id,
			accion: activo ? 'activar' : 'eliminar',
			cambios: {
				antes: snapshotSubcategoria(current),
				despues: snapshotSubcategoria(saved),
			},
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Patch subcategoria error:', error);
		return json({ error: 'No se pudo actualizar la subcategoría.' }, 500);
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Subcategoría no encontrada.' }, 404);

	try {
		const current = await getSubcategoriaById(id);
		if (!current) return json({ error: 'Subcategoría no encontrada.' }, 404);

		if (!current.activo) {
			return json({ ok: true, item: current });
		}

		const productos = await countProductosBySubcategoria(current.id);
		const saved = await setSubcategoriaActivo(current.id, false);
		if (!saved) return json({ error: 'No se pudo desactivar la subcategoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'subcategorias',
			entidadId: saved.id,
			accion: 'eliminar',
			cambios: {
				antes: snapshotSubcategoria(current),
				despues: snapshotSubcategoria(saved),
				productos,
			},
		});

		return json({
			ok: true,
			item: saved,
			productos,
		});
	} catch (error) {
		console.error('Delete subcategoria error:', error);
		return json({ error: 'No se pudo desactivar la subcategoría.' }, 500);
	}
};
