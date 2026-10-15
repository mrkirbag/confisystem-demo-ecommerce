import type { APIRoute } from 'astro';
import { confirmarPedido, cancelarPedido } from '@/lib/pedidos';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
	try {
		const admin = locals.admin;
		if (!admin) {
			return new Response(JSON.stringify({ error: 'No autorizado' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const id = params.id;
		if (!id) {
			return new Response(JSON.stringify({ error: 'ID de pedido no proporcionado' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const body = (await request.json()) as { action: 'confirmar' | 'cancelar' };
		if (!body || !body.action) {
			return new Response(JSON.stringify({ error: 'Acción no especificada' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const actor = {
			id: admin.id,
			nombre: admin.nombre,
			correo: admin.correo,
		};

		let resultado;
		if (body.action === 'confirmar') {
			resultado = await confirmarPedido(id, actor);
		} else if (body.action === 'cancelar') {
			resultado = await cancelarPedido(id, actor);
		} else {
			return new Response(JSON.stringify({ error: 'Acción no válida' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ ok: true, pedido: resultado }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error cambiando estado de pedido:', error);
		const message = error instanceof Error ? error.message : 'Error al cambiar estado';
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
