import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import type { AdminSession } from '@/lib/auth';
import {
	countProductosByCategoria,
	getCategoriaById,
	sanitizeCategoriaInput,
	setCategoriaActivo,
	slugEnUso,
	snapshotCategoria,
	uniqueConstraintError,
	updateCategoria,
	validateCategoriaInput,
} from '@/lib/categorias';

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
	if (!id) return json({ error: 'Categoría no encontrada.' }, 404);

	try {
		const current = await getCategoriaById(id);
		if (!current) return json({ error: 'Categoría no encontrada.' }, 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeCategoriaInput(body);
		const error = validateCategoriaInput(input);
		if (error) return json({ error }, 400);

		if (await slugEnUso(input.slug, current.id)) {
			return json({ error: 'Ya existe una categoría con ese slug.' }, 400);
		}

		const saved = await updateCategoria(current.id, input);
		if (!saved) return json({ error: 'No se pudo guardar la categoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'categorias',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: {
				antes: snapshotCategoria(current),
				despues: snapshotCategoria(saved),
			},
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Update categoria error:', error);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe una categoría con ese slug.' }, 400);
		}
		return json({ error: 'No se pudo guardar la categoría.' }, 500);
	}
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Categoría no encontrada.' }, 404);

	try {
		const current = await getCategoriaById(id);
		if (!current) return json({ error: 'Categoría no encontrada.' }, 404);

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const activo = body.activo === true || body.activo === 1 || body.activo === '1' || body.activo === 'true';

		const saved = await setCategoriaActivo(current.id, activo);
		if (!saved) return json({ error: 'No se pudo actualizar la categoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'categorias',
			entidadId: saved.id,
			accion: activo ? 'activar' : 'eliminar',
			cambios: {
				antes: snapshotCategoria(current),
				despues: snapshotCategoria(saved),
			},
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Patch categoria error:', error);
		return json({ error: 'No se pudo actualizar la categoría.' }, 500);
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Categoría no encontrada.' }, 404);

	try {
		const current = await getCategoriaById(id);
		if (!current) return json({ error: 'Categoría no encontrada.' }, 404);

		if (!current.activo) {
			return json({ ok: true, item: current });
		}

		const productos = await countProductosByCategoria(current.id);
		const saved = await setCategoriaActivo(current.id, false);
		if (!saved) return json({ error: 'No se pudo desactivar la categoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'categorias',
			entidadId: saved.id,
			accion: 'eliminar',
			cambios: {
				antes: snapshotCategoria(current),
				despues: snapshotCategoria(saved),
				productos,
			},
		});

		return json({
			ok: true,
			item: saved,
			productos,
		});
	} catch (error) {
		console.error('Delete categoria error:', error);
		return json({ error: 'No se pudo desactivar la categoría.' }, 500);
	}
};
