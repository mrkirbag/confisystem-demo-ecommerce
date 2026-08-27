import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import type { AdminSession } from '@/lib/auth';
import {
	deleteAtributo,
	getAtributoById,
	nombreEnUso,
	sanitizeAtributoInput,
	snapshotAtributo,
	uniqueConstraintError,
	updateAtributo,
	validateAtributoInput,
} from '@/lib/atributos';

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
	if (!id) return json({ error: 'Atributo no encontrado.' }, 404);

	try {
		const current = await getAtributoById(id);
		if (!current) return json({ error: 'Atributo no encontrado.' }, 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeAtributoInput(body);
		const error = validateAtributoInput(input);
		if (error) return json({ error }, 400);

		if (await nombreEnUso(input.nombre, current.id)) {
			return json({ error: 'Ya existe un atributo con ese nombre.' }, 400);
		}

		const saved = await updateAtributo(current.id, input);
		if (!saved) return json({ error: 'No se pudo guardar el atributo.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'atributos_config',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: {
				antes: snapshotAtributo(current),
				despues: snapshotAtributo(saved),
			},
		});

		return json({ ok: true, item: saved });
	} catch (error) {
		console.error('Update atributo error:', error);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe un atributo con ese nombre.' }, 400);
		}
		return json({ error: 'No se pudo guardar el atributo.' }, 500);
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Atributo no encontrado.' }, 404);

	try {
		const current = await getAtributoById(id);
		if (!current) return json({ error: 'Atributo no encontrado.' }, 404);

		if (current.usos > 0) {
			return json(
				{
					error: `No se puede eliminar. Lo usan ${current.usos} ${current.usos === 1 ? 'producto' : 'productos'}.`,
				},
				400,
			);
		}

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'atributos_config',
			entidadId: current.id,
			accion: 'eliminar',
			cambios: { antes: snapshotAtributo(current) },
		});

		await deleteAtributo(current.id);

		return json({ ok: true, id: current.id });
	} catch (error) {
		console.error('Delete atributo error:', error);
		return json({ error: 'No se pudo eliminar el atributo.' }, 500);
	}
};
