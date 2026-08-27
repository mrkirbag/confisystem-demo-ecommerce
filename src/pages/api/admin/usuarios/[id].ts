import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import { setAdminSessionCookie, signAdminToken, type AdminSession } from '@/lib/auth';
import {
	correoEnUso,
	deleteUsuario,
	getUsuarioById,
	sanitizeUsuarioInput,
	uniqueConstraintError,
	updateUsuario,
	validateUsuarioInput,
} from '@/lib/usuarios';

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

export const PUT: APIRoute = async ({ params, request, locals, cookies }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Usuario no encontrado.' }, 404);

	try {
		const current = await getUsuarioById(id);
		if (!current) return json({ error: 'Usuario no encontrado.' }, 404);

		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeUsuarioInput(body);
		const error = validateUsuarioInput(input, { requirePassword: false });
		if (error) return json({ error }, 400);

		if (await correoEnUso(input.correo, current.id)) {
			return json({ error: 'Ya existe un usuario con ese correo.' }, 400);
		}

		const saved = await updateUsuario(current.id, input);
		if (!saved) return json({ error: 'No se pudo guardar el usuario.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'usuarios_admin',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: {
				antes: { nombre: current.nombre, correo: current.correo },
				despues: { nombre: saved.nombre, correo: saved.correo },
				password_changed: Boolean(input.password),
			},
		});

		if (current.id === admin.id) {
			const token = await signAdminToken({
				id: saved.id,
				correo: saved.correo,
				nombre: saved.nombre,
				rol: saved.rol,
			});
			setAdminSessionCookie(cookies, token);
		}

		return json({
			ok: true,
			item: saved,
		});
	} catch (error) {
		console.error('Update usuario error:', error);
		if (uniqueConstraintError(error)) {
			return json({ error: 'Ya existe un usuario con ese correo.' }, 400);
		}
		return json({ error: 'No se pudo guardar el usuario.' }, 500);
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const denied = guard(locals.admin);
	if (denied) return denied;

	const admin = locals.admin!;
	const id = params.id;
	if (!id) return json({ error: 'Usuario no encontrado.' }, 404);

	try {
		const current = await getUsuarioById(id);
		if (!current) return json({ error: 'Usuario no encontrado.' }, 404);

		if (current.id === admin.id) {
			return json({ error: 'No puedes eliminar tu propia cuenta.' }, 400);
		}

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'usuarios_admin',
			entidadId: current.id,
			accion: 'eliminar',
			cambios: { antes: { nombre: current.nombre, correo: current.correo } },
		});

		await deleteUsuario(current.id, admin.id);

		return json({
			ok: true,
			id: current.id,
		});
	} catch (error) {
		console.error('Delete usuario error:', error);
		return json({ error: 'No se pudo eliminar el usuario.' }, 500);
	}
};
