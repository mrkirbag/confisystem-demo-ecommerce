import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	createAtributo,
	listAtributos,
	nombreEnUso,
	sanitizeAtributoInput,
	snapshotAtributo,
	uniqueConstraintError,
	validateAtributoInput,
} from '@/lib/atributos';

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
		const items = await listAtributos();
		return json({ items });
	} catch (error) {
		console.error('List atributos error:', error);
		return json({ error: 'No se pudieron cargar los atributos.' }, 500);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeAtributoInput(body);
		const error = validateAtributoInput(input);
		if (error) return json({ error }, 400);

		if (await nombreEnUso(input.nombre)) {
			return json({ error: 'Ya existe un atributo con ese nombre.' }, 400);
		}

		const saved = await createAtributo(input);
		if (!saved) return json({ error: 'No se pudo crear el atributo.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'atributos_config',
			entidadId: saved.id,
			accion: 'crear',
			cambios: { despues: snapshotAtributo(saved) },
		});

		return json({ ok: true, item: saved });
	} catch (error) {
		console.error('Create atributo error:', error);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe un atributo con ese nombre.' }, 400);
		}
		return json({ error: 'No se pudo crear el atributo.' }, 500);
	}
};
