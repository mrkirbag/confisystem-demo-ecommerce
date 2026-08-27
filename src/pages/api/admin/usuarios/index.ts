import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	correoEnUso,
	createUsuario,
	listUsuarios,
	sanitizeUsuarioInput,
	uniqueConstraintError,
	validateUsuarioInput,
} from '@/lib/usuarios';

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
		const items = await listUsuarios();
		return json({ items });
	} catch (error) {
		console.error('List usuarios error:', error);
		return json({ error: 'No se pudieron cargar los usuarios.' }, 500);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeUsuarioInput(body);
		const error = validateUsuarioInput(input, { requirePassword: true });
		if (error) return json({ error }, 400);

		if (await correoEnUso(input.correo)) {
			return json({ error: 'Ya existe un usuario con ese correo.' }, 400);
		}

		const saved = await createUsuario(input);
		if (!saved) return json({ error: 'No se pudo crear el usuario.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'usuarios_admin',
			entidadId: saved.id,
			accion: 'crear',
			cambios: { despues: { nombre: saved.nombre, correo: saved.correo } },
		});

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Create usuario error:', error);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe un usuario con ese correo.' }, 400);
		}
		return json({ error: 'No se pudo crear el usuario.' }, 500);
	}
};
