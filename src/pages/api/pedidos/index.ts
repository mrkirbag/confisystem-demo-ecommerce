import type { APIRoute } from 'astro';
import { crearPedido, type CrearPedidoInput } from '@/lib/pedidos';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = (await request.json()) as CrearPedidoInput;

		if (!body || !body.cliente_nombre || !body.cliente_telefono) {
			return new Response(
				JSON.stringify({ error: 'Faltan datos obligatorios del cliente (nombre o teléfono)' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		if (!Array.isArray(body.items) || body.items.length === 0) {
			return new Response(
				JSON.stringify({ error: 'El carrito no contiene productos' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const result = await crearPedido(body);

		return new Response(JSON.stringify(result), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error creando pedido:', error);
		const message = error instanceof Error ? error.message : 'Error al procesar el pedido';
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
