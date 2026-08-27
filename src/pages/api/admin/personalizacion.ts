import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	getTiendaPersonalizacion,
	sanitizePersonalizacionInput,
	saveTiendaPersonalizacion,
	validatePersonalizacionInput,
} from '@/lib/tienda';

export const prerender = false;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const PUT: APIRoute = async ({ request, locals }) => {
	const admin = locals.admin;
	if (!admin) return json({ error: 'No autorizado' }, 401);

	try {
		const current = await getTiendaPersonalizacion();
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizePersonalizacionInput(body);
		const error = validatePersonalizacionInput(input);
		if (error) return json({ error }, 400);

		const saved = await saveTiendaPersonalizacion(input);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'tienda_personalizacion',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: { antes: current, despues: saved },
		});

		return json({
			ok: true,
			item: saved,
			redirect: '/admin/configuracion/identidad-visual?ok=updated',
		});
	} catch (error) {
		console.error('Save personalizacion error:', error);
		return json({ error: 'No se pudo guardar la identidad visual.' }, 500);
	}
};
