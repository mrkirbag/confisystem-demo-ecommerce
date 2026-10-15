import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	try {
		const admin = locals.admin;
		if (!admin) {
			return new Response(JSON.stringify({ error: 'No autorizado' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const db = getDb();

		// Cargar productos activos con sus variantes e imágenes
		const prodsRes = await db.execute(`
			SELECT
				p.id,
				p.nombre,
				p.slug,
				p.precio_base,
				p.en_oferta,
				p.precio_oferta,
				p.precio_por_variante,
				(
					SELECT url FROM productos_imagenes
					WHERE producto_id = p.id
					ORDER BY orden ASC LIMIT 1
				) AS imagen_url
			FROM productos p
			WHERE p.activo = 1
			ORDER BY p.nombre ASC
		`);

		const varsRes = await db.execute(`
			SELECT
				v.id,
				v.producto_id,
				v.combinacion,
				v.stock,
				v.sku,
				v.precio,
				COALESCE(v.precio_oferta, 0) AS precio_oferta
			FROM producto_stock_variantes v
			ORDER BY v.combinacion ASC
		`);

		const variantesMap = new Map<string, any[]>();
		for (const row of varsRes.rows) {
			const r = row as Record<string, unknown>;
			const pId = String(r.producto_id);
			const list = variantesMap.get(pId) || [];
			list.push({
				id: String(r.id),
				combinacion: String(r.combinacion || 'Único'),
				stock: Number(r.stock ?? 0),
				sku: String(r.sku || ''),
				precio: Number(r.precio ?? 0),
				precio_oferta: Number(r.precio_oferta ?? 0),
			});
			variantesMap.set(pId, list);
		}

		const productos = prodsRes.rows.map((row) => {
			const r = row as Record<string, unknown>;
			const pId = String(r.id);
			return {
				id: pId,
				nombre: String(r.nombre || ''),
				slug: String(r.slug || ''),
				precio_base: Number(r.precio_base ?? 0),
				en_oferta: Boolean(r.en_oferta),
				precio_oferta: Number(r.precio_oferta ?? 0),
				precio_por_variante: Boolean(r.precio_por_variante),
				imagen_url: r.imagen_url ? String(r.imagen_url) : null,
				variantes: variantesMap.get(pId) || [],
			};
		});

		return new Response(JSON.stringify({ productos }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error listando productos disponibles:', error);
		return new Response(JSON.stringify({ error: 'Error al cargar productos' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
