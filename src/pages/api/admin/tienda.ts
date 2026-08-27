import type { APIRoute } from 'astro';
import { registrarAuditoria } from '@/lib/auditoria';
import {
	getTiendaConfiguracion,
	sanitizeTiendaInput,
	saveTiendaConfiguracion,
	validateTiendaInput,
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
		const current = await getTiendaConfiguracion();
		const body = (await request.json()) as Record<string, unknown>;
		const input = sanitizeTiendaInput(body);
		const error = validateTiendaInput(input);
		if (error) return json({ error }, 400);

		const saved = await saveTiendaConfiguracion(input);
		if (!saved) return json({ error: 'No se pudo guardar la tienda.' }, 500);

		await registrarAuditoria({
			usuarioId: admin.id,
			actor: admin,
			entidad: 'tienda_configuracion',
			entidadId: saved.id,
			accion: 'actualizar',
			cambios: { antes: current, despues: saved },
		});

		return json({
			ok: true,
			item: saved,
			redirect: '/admin/configuracion/tienda?ok=updated',
		});
	} catch (error) {
		console.error('Save tienda error:', error);
		return json({ error: 'No se pudo guardar la tienda.' }, 500);
	}
};
