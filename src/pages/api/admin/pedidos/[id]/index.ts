import type { APIRoute } from 'astro';
import { actualizarPedidoAdmin, type ModificarPedidoInput } from '@/lib/pedidos';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals }) => {
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

		const body = (await request.json()) as ModificarPedidoInput;
		if (!body || !Array.isArray(body.items)) {
			return new Response(JSON.stringify({ error: 'Datos de pedido inválidos' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const actualizado = await actualizarPedidoAdmin(
			id,
			body,
			{
				id: admin.id,
				nombre: admin.nombre,
				correo: admin.correo,
			},
		);

		return new Response(JSON.stringify({ ok: true, pedido: actualizado }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error actualizando pedido:', error);
		const message = error instanceof Error ? error.message : 'Error al actualizar el pedido';
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
