import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	createSubcategoria,
	knownSubcategoriaError,
	listSubcategorias,
	sanitizeSubcategoriaInput,
	slugEnUso,
	snapshotSubcategoria,
	uniqueConstraintError,
	validateSubcategoriaInput,
} from '@/lib/subcategorias';

export const prerender = false;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const GET: APIRoute = async ({ url, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const categoriaId = url.searchParams.get('categoria_id')?.trim() || undefined;
		const items = await listSubcategorias(categoriaId);
		return json({ items });
	} catch (error) {
		console.error('List subcategorias error:', error);
		return json({ error: 'No se pudieron cargar las subcategorías.' }, 500);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeSubcategoriaInput(body);
		const error = validateSubcategoriaInput(input);
		if (error) return json({ error }, 400);

		if (await slugEnUso(input.slug, input.categoria_id)) {
			return json({ error: 'Ya existe una subcategoría con ese slug en esta categoría.' }, 400);
		}

		const saved = await createSubcategoria(input);
		if (!saved) return json({ error: 'No se pudo crear la subcategoría.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'subcategorias',
			entidadId: saved.id,
			accion: 'crear',
			cambios: { despues: snapshotSubcategoria(saved) },
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Create subcategoria error:', error);
		const known = knownSubcategoriaError(error);
		if (known) return json({ error: known }, 400);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe una subcategoría con ese slug en esta categoría.' }, 400);
		}
		return json({ error: 'No se pudo crear la subcategoría.' }, 500);
	}
};
