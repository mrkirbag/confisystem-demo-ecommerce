import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	createCategoria,
	listCategorias,
	sanitizeCategoriaInput,
	slugEnUso,
	snapshotCategoria,
	uniqueConstraintError,
	validateCategoriaInput,
} from '@/lib/categorias';

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
		const items = await listCategorias();
		return json({ items });
	} catch (error) {
		console.error('List categorias error:', error);
		return json({ error: 'No se pudieron cargar las categorías.' }, 500);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeCategoriaInput(body);
		const error = validateCategoriaInput(input);
		if (error) return json({ error }, 400);

		if (await slugEnUso(input.slug)) {
			return json({ error: 'Ya existe una categoría con ese slug.' }, 400);
		}

		const saved = await createCategoria(input);
		if (!saved) return json({ error: 'No se pudo crear la categoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'categorias',
			entidadId: saved.id,
			accion: 'crear',
			cambios: { despues: snapshotCategoria(saved) },
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Create categoria error:', error);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe una categoría con ese slug.' }, 400);
		}
		return json({ error: 'No se pudo crear la categoría.' }, 500);
	}
};
