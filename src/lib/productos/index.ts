import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { listAtributos } from '../atributos';
import {
	deleteImage,
	isProductSlot,
	keyFromPublicUrl,
	rekeyProductoImages,
	type ProductSlot,
} from '../r2';
import { isValidSlug } from '../categorias/shared';
import { ensureSubcategoriaSchema, getSubcategoriaById } from '../subcategorias';
import {
	COMBINACION_UNICA,
	MAX_COMBINACIONES,
	MAX_IMAGENES,
	allocateSkus,
	buildSkuBase,
	nextUniqueSku,
	toListado,
	type Producto,
	type ProductoDetalleTexto,
	type ProductoImagen,
	type ProductoListado,
	type ProductoVariante,
} from './shared';

export {
	COMBINACION_UNICA,
	MAX_COMBINACIONES,
	MAX_IMAGENES,
	PRODUCT_SLOTS,
	SKU_MAX_LENGTH,
	allocateSkus,
	cartesianCombinaciones,
	formatPrecio,
	formatPrecioRango,
	formatSkus,
	formatStock,
	inferVarianteSeleccion,
	initialsFromName,
	parseCombinacion,
	toListado,
	type Producto,
	type ProductoDetalleTexto,
	type ProductoImagen,
	type ProductoListado,
	type ProductoVariante,
} from './shared';

export type ProductoImagenInput = {
	orden: ProductSlot;
	url: string;
};

export type ProductoVarianteInput = {
	combinacion: string;
	stock: number;
	sku: string;
	precio: number;
};

export type ProductoDetalleInput = {
	atributo_id: string;
	valor: string;
};

export type ProductoInput = {
	subcategoria_id: string;
	nombre: string;
	slug: string;
	descripcion: string;
	precio_base: number;
	es_tendencia: boolean;
	en_oferta: boolean;
	precio_oferta: number;
	precio_por_variante: boolean;
	imagenes: ProductoImagenInput[];
	variantes: ProductoVarianteInput[];
	detalles: ProductoDetalleInput[];
	activo?: boolean;
};

function asText(value: unknown) {
	if (value == null) return '';
	return String(value).trim();
}

function asBool(value: unknown) {
	return value === true || value === 1 || value === '1' || value === 'on' || value === 'true';
}

function asPrice(value: unknown) {
	if (typeof value === 'string' && value.trim() === '') return 0;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return NaN;
	return Math.round(n * 100) / 100;
}

function asStock(value: unknown) {
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return NaN;
	return Math.min(999999, Math.round(n));
}

function asSlot(value: unknown): ProductSlot | null {
	const n = Number(value);
	return isProductSlot(n) ? n : null;
}

async function tableHasColumn(table: string, column: string) {
	const db = getDb();
	const cols = await db.execute(`PRAGMA table_info(${table})`);
	return cols.rows.some((row) => {
		const record = row as Record<string, unknown>;
		return String(record.name ?? '') === column;
	});
}

async function addColumn(sql: string) {
	try {
		await getDb().execute(sql);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!/duplicate column/i.test(message)) throw error;
	}
}

let schemaReady: Promise<void> | null = null;

async function ensureProductoSchema() {
	if (!schemaReady) {
		schemaReady = (async () => {
			const db = getDb();
			await ensureSubcategoriaSchema();

			if (!(await tableHasColumn('producto_stock_variantes', 'precio'))) {
				await addColumn(
					`ALTER TABLE producto_stock_variantes ADD COLUMN precio REAL NOT NULL DEFAULT 0`,
				);
				await db.execute(`
					UPDATE producto_stock_variantes
					SET precio = COALESCE((
						SELECT precio_base FROM productos WHERE productos.id = producto_stock_variantes.producto_id
					), 0)
					WHERE precio = 0
				`);
			}

			if (!(await tableHasColumn('productos', 'precio_por_variante'))) {
				await addColumn(
					`ALTER TABLE productos ADD COLUMN precio_por_variante INTEGER NOT NULL DEFAULT 0`,
				);
				await db.execute(`
					UPDATE productos SET precio_por_variante = 1
					WHERE id IN (
						SELECT producto_id
						FROM producto_stock_variantes
						GROUP BY producto_id
						HAVING MIN(precio) <> MAX(precio)
					)
				`);
			}

			await ensureVarianteSkus();
		})();
	}

	await schemaReady;
}

async function loadTakenSkus() {
	const result = await getDb().execute(`
		SELECT sku FROM producto_stock_variantes
		WHERE sku IS NOT NULL AND TRIM(sku) != ''
	`);
	const taken = new Set<string>();
	for (const raw of result.rows) {
		const sku = asText((raw as Record<string, unknown>).sku).toUpperCase();
		if (sku) taken.add(sku);
	}
	return taken;
}

async function ensureVarianteSkus() {
	const db = getDb();
	const missing = await db.execute(`
		SELECT v.id, v.combinacion, p.slug
		FROM producto_stock_variantes v
		INNER JOIN productos p ON p.id = v.producto_id
		WHERE v.sku IS NULL OR TRIM(v.sku) = ''
	`);

	if (missing.rows.length > 0) {
		const taken = await loadTakenSkus();
		for (const raw of missing.rows) {
			const row = raw as Record<string, unknown>;
			const sku = nextUniqueSku(
				buildSkuBase(asText(row.slug), asText(row.combinacion) || COMBINACION_UNICA),
				taken,
			);
			taken.add(sku.toUpperCase());
			await db.execute({
				sql: `UPDATE producto_stock_variantes SET sku = ? WHERE id = ?`,
				args: [sku, String(row.id)],
			});
		}
	}

	const duplicates = await db.execute(`
		SELECT sku FROM producto_stock_variantes
		WHERE sku IS NOT NULL AND TRIM(sku) != ''
		GROUP BY sku
		HAVING COUNT(*) > 1
	`);

	if (duplicates.rows.length > 0) {
		const taken = await loadTakenSkus();
		for (const raw of duplicates.rows) {
			const sku = asText((raw as Record<string, unknown>).sku);
			if (!sku) continue;
			const rows = await db.execute({
				sql: `
					SELECT v.id, v.combinacion, p.slug
					FROM producto_stock_variantes v
					INNER JOIN productos p ON p.id = v.producto_id
					WHERE v.sku = ?
					ORDER BY v.id
				`,
				args: [sku],
			});
			for (let i = 1; i < rows.rows.length; i++) {
				const row = rows.rows[i] as Record<string, unknown>;
				const generated = nextUniqueSku(
					buildSkuBase(asText(row.slug), asText(row.combinacion) || COMBINACION_UNICA),
					taken,
				);
				taken.add(generated.toUpperCase());
				await db.execute({
					sql: `UPDATE producto_stock_variantes SET sku = ? WHERE id = ?`,
					args: [generated, String(row.id)],
				});
			}
		}
	}

	try {
		await db.execute(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_variantes_sku
			ON producto_stock_variantes(sku)
		`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!/already exists/i.test(message)) throw error;
	}
}

function mapListado(row: Record<string, unknown>): ProductoListado {
	const base = Number(row.precio_base ?? 0);
	const minRaw = row.precio_min == null ? NaN : Number(row.precio_min);
	const maxRaw = row.precio_max == null ? NaN : Number(row.precio_max);
	const precio_min = Number.isFinite(minRaw) ? minRaw : base;
	const precio_max = Number.isFinite(maxRaw) ? maxRaw : base;

	return {
		id: String(row.id),
		categoria_id: String(row.categoria_id),
		categoria_nombre: asText(row.categoria_nombre),
		subcategoria_id: row.subcategoria_id == null || row.subcategoria_id === '' ? null : String(row.subcategoria_id),
		subcategoria_nombre: asText(row.subcategoria_nombre) || null,
		nombre: asText(row.nombre),
		slug: asText(row.slug),
		imagen_url: row.imagen_url == null || row.imagen_url === '' ? null : String(row.imagen_url),
		precio_base: base,
		es_tendencia: asBool(row.es_tendencia),
		en_oferta: asBool(row.en_oferta),
		precio_oferta: Number(row.precio_oferta ?? 0),
		precio_por_variante: asBool(row.precio_por_variante),
		precio_min: asBool(row.precio_por_variante) ? precio_min : base,
		precio_max: asBool(row.precio_por_variante) ? precio_max : base,
		activo: asBool(row.activo),
		stock_total: Number(row.stock_total ?? 0),
		skus: asText(row.skus)
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean),
	};
}

const SELECT_LIST = `
	SELECT
		p.id,
		p.categoria_id,
		p.subcategoria_id,
		p.nombre,
		p.slug,
		p.precio_base,
		p.es_tendencia,
		p.en_oferta,
		p.precio_oferta,
		p.precio_por_variante,
		p.activo,
		c.nombre AS categoria_nombre,
		s.nombre AS subcategoria_nombre,
		(
			SELECT url FROM productos_imagenes
			WHERE producto_id = p.id
			ORDER BY orden ASC
			LIMIT 1
		) AS imagen_url,
		(
			SELECT COALESCE(SUM(stock), 0) FROM producto_stock_variantes
			WHERE producto_id = p.id
		) AS stock_total,
		(
			SELECT MIN(precio) FROM producto_stock_variantes
			WHERE producto_id = p.id
		) AS precio_min,
		(
			SELECT MAX(precio) FROM producto_stock_variantes
			WHERE producto_id = p.id
		) AS precio_max,
		(
			SELECT GROUP_CONCAT(sku, ',')
			FROM producto_stock_variantes
			WHERE producto_id = p.id AND sku IS NOT NULL AND TRIM(sku) != ''
		) AS skus
	FROM productos p
	INNER JOIN categorias c ON c.id = p.categoria_id
	LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
`;

export function sanitizeProductoInput(raw: Record<string, unknown>): ProductoInput {
	const imagenesRaw = Array.isArray(raw.imagenes) ? raw.imagenes : [];
	const seenSlots = new Set<ProductSlot>();
	const imagenes: ProductoImagenInput[] = [];

	for (const item of imagenesRaw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const orden = asSlot(row.orden);
		const url = asText(row.url);
		if (!orden || !url || seenSlots.has(orden)) continue;
		seenSlots.add(orden);
		imagenes.push({ orden, url });
	}

	imagenes.sort((a, b) => a.orden - b.orden);

	const variantesRaw = Array.isArray(raw.variantes) ? raw.variantes : [];
	const seenCombo = new Set<string>();
	const variantes: ProductoVarianteInput[] = [];

	for (const item of variantesRaw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const combinacion = asText(row.combinacion) || COMBINACION_UNICA;
		if (seenCombo.has(combinacion)) continue;
		seenCombo.add(combinacion);
		const stock = asStock(row.stock);
		const precio = asPrice(row.precio);
		variantes.push({
			combinacion,
			stock: Number.isFinite(stock) ? stock : 0,
			sku: asText(row.sku).slice(0, 40),
			precio: Number.isFinite(precio) ? precio : 0,
		});
	}

	const detallesRaw = Array.isArray(raw.detalles) ? raw.detalles : [];
	const seenAttr = new Set<string>();
	const detalles: ProductoDetalleInput[] = [];

	for (const item of detallesRaw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const atributo_id = asText(row.atributo_id);
		const valor = asText(row.valor);
		if (!atributo_id || !valor || seenAttr.has(atributo_id)) continue;
		seenAttr.add(atributo_id);
		detalles.push({ atributo_id, valor: valor.slice(0, 400) });
	}

	return {
		subcategoria_id: asText(raw.subcategoria_id),
		nombre: asText(raw.nombre),
		slug: asText(raw.slug).toLowerCase(),
		descripcion: asText(raw.descripcion).slice(0, 4000),
		precio_base: asPrice(raw.precio_base),
		es_tendencia: asBool(raw.es_tendencia),
		en_oferta: asBool(raw.en_oferta),
		precio_oferta: asPrice(raw.precio_oferta),
		precio_por_variante: asBool(raw.precio_por_variante),
		imagenes,
		variantes: asBool(raw.precio_por_variante)
			? variantes
			: variantes.map((item) => ({ ...item, precio: asPrice(raw.precio_base) })),
		detalles,
		activo: raw.activo == null ? undefined : asBool(raw.activo),
	};
}

export function validateProductoInput(input: ProductoInput) {
	if (!input.subcategoria_id) return 'Elige una subcategoría.';
	if (!input.nombre || input.nombre.length < 2) return 'El nombre es obligatorio.';
	if (input.nombre.length > 120) return 'El nombre es demasiado largo.';
	if (!isValidSlug(input.slug)) return 'El slug no es válido. Usa minúsculas, números y guiones.';
	if (!Number.isFinite(input.precio_base)) return 'El precio no es válido.';
	if (input.precio_base < 0) return 'El precio no puede ser negativo.';
	if (input.en_oferta) {
		if (!Number.isFinite(input.precio_oferta) || input.precio_oferta <= 0) {
			return 'Indica el precio de oferta.';
		}
		const minimo = input.precio_por_variante
			? Math.min(input.precio_base, ...input.variantes.map((item) => item.precio))
			: input.precio_base;
		if (input.precio_oferta >= minimo) {
			return input.precio_por_variante
				? 'El precio de oferta debe ser menor que el precio más bajo de las variantes.'
				: 'El precio de oferta debe ser menor que el precio normal.';
		}
	}
	if (input.imagenes.length > MAX_IMAGENES) return 'Puedes subir como máximo 3 imágenes.';
	if (input.variantes.length < 1) return 'Indica al menos una variante de stock.';
	if (input.variantes.length > MAX_COMBINACIONES) {
		return `Demasiadas combinaciones. El máximo es ${MAX_COMBINACIONES}.`;
	}
	for (const variante of input.variantes) {
		if (!Number.isFinite(variante.stock) || variante.stock < 0) {
			return `El stock de “${variante.combinacion}” no es válido.`;
		}
		if (!Number.isFinite(variante.precio) || variante.precio < 0) {
			return `El precio de “${variante.combinacion}” no es válido.`;
		}
	}
	return null;
}

export async function listProductos() {
	await ensureProductoSchema();
	const db = getDb();
	const result = await db.execute(`${SELECT_LIST} ORDER BY p.nombre COLLATE NOCASE`);
	return result.rows.map((row) => mapListado(row as Record<string, unknown>));
}

async function loadImagenes(ids: string[]) {
	const map = new Map<string, ProductoImagen[]>();
	if (ids.length === 0) return map;
	const db = getDb();
	const placeholders = ids.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `
			SELECT id, producto_id, url, orden
			FROM productos_imagenes
			WHERE producto_id IN (${placeholders})
			ORDER BY orden ASC
		`,
		args: ids,
	});
	for (const raw of result.rows) {
		const row = raw as Record<string, unknown>;
		const productoId = String(row.producto_id);
		const orden = asSlot(row.orden);
		if (!orden) continue;
		const list = map.get(productoId) ?? [];
		list.push({
			id: String(row.id),
			url: String(row.url),
			orden,
		});
		map.set(productoId, list);
	}
	return map;
}

async function loadVariantes(ids: string[]) {
	const map = new Map<string, ProductoVariante[]>();
	if (ids.length === 0) return map;
	const db = getDb();
	const placeholders = ids.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `
			SELECT id, producto_id, combinacion, stock, sku, precio
			FROM producto_stock_variantes
			WHERE producto_id IN (${placeholders})
			ORDER BY combinacion COLLATE NOCASE
		`,
		args: ids,
	});
	for (const raw of result.rows) {
		const row = raw as Record<string, unknown>;
		const productoId = String(row.producto_id);
		const list = map.get(productoId) ?? [];
		list.push({
			id: String(row.id),
			combinacion: asText(row.combinacion) || COMBINACION_UNICA,
			stock: Number(row.stock ?? 0),
			sku: asText(row.sku),
			precio: Number(row.precio ?? 0),
		});
		map.set(productoId, list);
	}
	return map;
}

async function loadDetalles(ids: string[]) {
	const map = new Map<string, ProductoDetalleTexto[]>();
	if (ids.length === 0) return map;
	const db = getDb();
	const placeholders = ids.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `
			SELECT id, producto_id, atributo_id, valor
			FROM producto_detalles_texto
			WHERE producto_id IN (${placeholders})
		`,
		args: ids,
	});
	for (const raw of result.rows) {
		const row = raw as Record<string, unknown>;
		const productoId = String(row.producto_id);
		const list = map.get(productoId) ?? [];
		list.push({
			id: String(row.id),
			atributo_id: String(row.atributo_id),
			valor: asText(row.valor),
		});
		map.set(productoId, list);
	}
	return map;
}

export async function getProductoById(id: string): Promise<Producto | null> {
	await ensureProductoSchema();
	const db = getDb();
	const result = await db.execute({
		sql: `
			SELECT
				p.id,
				p.categoria_id,
				p.subcategoria_id,
				p.nombre,
				p.slug,
				p.descripcion,
				p.precio_base,
				p.es_tendencia,
				p.en_oferta,
				p.precio_oferta,
				p.precio_por_variante,
				p.activo,
				p.creado_en,
				c.nombre AS categoria_nombre,
				s.nombre AS subcategoria_nombre,
				(
					SELECT url FROM productos_imagenes
					WHERE producto_id = p.id
					ORDER BY orden ASC
					LIMIT 1
				) AS imagen_url,
				(
					SELECT COALESCE(SUM(stock), 0) FROM producto_stock_variantes
					WHERE producto_id = p.id
				) AS stock_total
			FROM productos p
			INNER JOIN categorias c ON c.id = p.categoria_id
			LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
			WHERE p.id = ?
			LIMIT 1
		`,
		args: [id],
	});
	const row = result.rows[0] as Record<string, unknown> | undefined;
	if (!row) return null;

	const [imagenes, variantes, detalles] = await Promise.all([
		loadImagenes([id]),
		loadVariantes([id]),
		loadDetalles([id]),
	]);

	const listado = mapListado(row);
	const producto: Producto = {
		...listado,
		descripcion: asText(row.descripcion),
		creado_en: String(row.creado_en ?? ''),
		imagenes: imagenes.get(id) ?? [],
		variantes: variantes.get(id) ?? [],
		detalles: detalles.get(id) ?? [],
	};

	return { ...producto, ...toListado(producto) };
}

export async function getProductoBySlug(slug: string): Promise<Producto | null> {
	await ensureProductoSchema();
	const db = getDb();
	const result = await db.execute({
		sql: `
			SELECT
				p.id,
				p.categoria_id,
				p.subcategoria_id,
				p.nombre,
				p.slug,
				p.descripcion,
				p.precio_base,
				p.es_tendencia,
				p.en_oferta,
				p.precio_oferta,
				p.precio_por_variante,
				p.activo,
				p.creado_en,
				c.nombre AS categoria_nombre,
				s.nombre AS subcategoria_nombre,
				(
					SELECT url FROM productos_imagenes
					WHERE producto_id = p.id
					ORDER BY orden ASC
					LIMIT 1
				) AS imagen_url,
				(
					SELECT COALESCE(SUM(stock), 0) FROM producto_stock_variantes
					WHERE producto_id = p.id
				) AS stock_total
			FROM productos p
			INNER JOIN categorias c ON c.id = p.categoria_id
			LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
			WHERE p.slug = ?
			LIMIT 1
		`,
		args: [slug],
	});
	const row = result.rows[0] as Record<string, unknown> | undefined;
	if (!row) return null;

	const id = String(row.id);
	const [imagenes, variantes, detalles] = await Promise.all([
		loadImagenes([id]),
		loadVariantes([id]),
		loadDetalles([id]),
	]);

	const listado = mapListado(row);
	const producto: Producto = {
		...listado,
		descripcion: asText(row.descripcion),
		creado_en: String(row.creado_en ?? ''),
		imagenes: imagenes.get(id) ?? [],
		variantes: variantes.get(id) ?? [],
		detalles: detalles.get(id) ?? [],
	};

	return { ...producto, ...toListado(producto) };
}

export async function slugEnUso(slug: string, excludeId?: string) {
	const db = getDb();
	const result = await db.execute({
		sql: excludeId
			? `SELECT id FROM productos WHERE slug = ? AND id != ? LIMIT 1`
			: `SELECT id FROM productos WHERE slug = ? LIMIT 1`,
		args: excludeId ? [slug, excludeId] : [slug],
	});
	return result.rows.length > 0;
}

async function assertSubcategoria(subcategoriaId: string) {
	const subcategoria = await getSubcategoriaById(subcategoriaId);
	if (!subcategoria) throw new Error('SUBCATEGORIA_NO_EXISTE');
	return subcategoria;
}

async function sanitizeDetallesAgainstAtributos(detalles: ProductoDetalleInput[]) {
	if (detalles.length === 0) return [];
	const atributos = await listAtributos();
	const byId = new Map(atributos.map((item) => [item.id, item]));
	const next: ProductoDetalleInput[] = [];

	for (const detalle of detalles) {
		const atributo = byId.get(detalle.atributo_id);
		if (!atributo) continue;
		if (atributo.tipo === 'seleccion_unica') continue;
		if (atributo.tipo === 'numero' && !Number.isFinite(Number(detalle.valor))) {
			throw new Error('DETALLE_NUMERO');
		}
		next.push(detalle);
	}

	return next;
}

function imageUsesSlug(url: string, slug: string) {
	try {
		return new URL(url).pathname.includes(`/productos/${slug}/`);
	} catch {
		return url.includes(`/productos/${slug}/`);
	}
}

async function syncImagenes(
	productoId: string,
	imagenes: ProductoImagenInput[],
	previous: ProductoImagen[],
	oldSlug: string,
	newSlug: string,
) {
	let next = imagenes;

	if (oldSlug !== newSlug) {
		const slotsToMove = next
			.filter((img) => imageUsesSlug(img.url, oldSlug))
			.map((img) => img.orden);
		if (slotsToMove.length > 0) {
			const moved = await rekeyProductoImages(oldSlug, newSlug, slotsToMove);
			next = next.map((img) => {
				const url = moved.get(img.orden);
				return url ? { ...img, url } : img;
			});
		}
	}

	const keptKeys = new Set(
		next.map((img) => keyFromPublicUrl(img.url)).filter((key): key is string => Boolean(key)),
	);

	for (const prev of previous) {
		const key = keyFromPublicUrl(prev.url);
		if (key && keptKeys.has(key)) continue;
		if (next.some((img) => img.url === prev.url)) continue;
		try {
			await deleteImage(prev.url);
		} catch (error) {
			console.error('No se pudo borrar una imagen de producto:', error);
		}
	}

	const db = getDb();
	await db.execute({
		sql: `DELETE FROM productos_imagenes WHERE producto_id = ?`,
		args: [productoId],
	});

	for (const img of next) {
		await db.execute({
			sql: `INSERT INTO productos_imagenes (id, producto_id, url, orden) VALUES (?, ?, ?, ?)`,
			args: [randomUUID(), productoId, img.url, img.orden],
		});
	}
}

async function syncVariantes(productoId: string, slug: string, variantes: ProductoVarianteInput[]) {
	const db = getDb();
	const existing = await db.execute({
		sql: `SELECT id, combinacion, sku FROM producto_stock_variantes WHERE producto_id = ?`,
		args: [productoId],
	});

	const byCombo = new Map<string, { id: string; sku: string }>();
	for (const raw of existing.rows) {
		const row = raw as Record<string, unknown>;
		byCombo.set(asText(row.combinacion) || COMBINACION_UNICA, {
			id: String(row.id),
			sku: asText(row.sku),
		});
	}

	const taken = await loadTakenSkus();
	const existingSkus: Record<string, string> = {};
	for (const [combinacion, row] of byCombo) {
		if (row.sku) existingSkus[combinacion] = row.sku;
	}
	const assigned = allocateSkus(
		slug,
		variantes.map((item) => item.combinacion),
		existingSkus,
		taken,
	);

	const keepIds = new Set<string>();

	for (const variante of variantes) {
		const sku =
			assigned[variante.combinacion] ||
			nextUniqueSku(buildSkuBase(slug, variante.combinacion), taken);
		taken.add(sku.toUpperCase());
		const current = byCombo.get(variante.combinacion);
		if (current) {
			await db.execute({
				sql: `UPDATE producto_stock_variantes SET stock = ?, sku = ?, precio = ? WHERE id = ?`,
				args: [variante.stock, sku, variante.precio, current.id],
			});
			keepIds.add(current.id);
			continue;
		}

		const id = randomUUID();
		await db.execute({
			sql: `
				INSERT INTO producto_stock_variantes (id, producto_id, combinacion, stock, sku, precio)
				VALUES (?, ?, ?, ?, ?, ?)
			`,
			args: [id, productoId, variante.combinacion, variante.stock, sku, variante.precio],
		});
		keepIds.add(id);
	}

	for (const raw of existing.rows) {
		const row = raw as Record<string, unknown>;
		const id = String(row.id);
		if (keepIds.has(id)) continue;

		const used = await db.execute({
			sql: `SELECT id FROM venta_items WHERE variante_id = ? LIMIT 1`,
			args: [id],
		});

		if (used.rows.length > 0) {
			await db.execute({
				sql: `UPDATE producto_stock_variantes SET stock = 0 WHERE id = ?`,
				args: [id],
			});
		} else {
			await db.execute({
				sql: `DELETE FROM producto_stock_variantes WHERE id = ?`,
				args: [id],
			});
		}
	}
}

async function syncDetalles(productoId: string, detalles: ProductoDetalleInput[]) {
	const db = getDb();
	await db.execute({
		sql: `DELETE FROM producto_detalles_texto WHERE producto_id = ?`,
		args: [productoId],
	});

	for (const detalle of detalles) {
		await db.execute({
			sql: `
				INSERT INTO producto_detalles_texto (id, producto_id, atributo_id, valor)
				VALUES (?, ?, ?, ?)
			`,
			args: [randomUUID(), productoId, detalle.atributo_id, detalle.valor],
		});
	}
}

export async function createProducto(input: ProductoInput) {
	await ensureProductoSchema();
	const subcategoria = await assertSubcategoria(input.subcategoria_id);
	const detalles = await sanitizeDetallesAgainstAtributos(input.detalles);
	const db = getDb();
	const id = randomUUID();

	await db.execute({
		sql: `
			INSERT INTO productos (
				id, categoria_id, subcategoria_id, nombre, slug, descripcion, precio_base,
				es_tendencia, en_oferta, precio_oferta, precio_por_variante, activo
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
		args: [
			id,
			subcategoria.categoria_id,
			subcategoria.id,
			input.nombre,
			input.slug,
			input.descripcion || null,
			input.precio_base,
			input.es_tendencia ? 1 : 0,
			input.en_oferta ? 1 : 0,
			input.en_oferta ? input.precio_oferta : 0,
			input.precio_por_variante ? 1 : 0,
			1,
		],
	});

	await syncImagenes(id, input.imagenes, [], input.slug, input.slug);
	await syncVariantes(id, input.slug, input.variantes);
	await syncDetalles(id, detalles);

	return getProductoById(id);
}

export async function updateProducto(id: string, input: ProductoInput) {
	const current = await getProductoById(id);
	if (!current) return null;

	const subcategoria = await assertSubcategoria(input.subcategoria_id);
	const detalles = await sanitizeDetallesAgainstAtributos(input.detalles);
	const activo = input.activo == null ? current.activo : input.activo;
	const db = getDb();

	await db.execute({
		sql: `
			UPDATE productos
			SET categoria_id = ?, subcategoria_id = ?, nombre = ?, slug = ?, descripcion = ?, precio_base = ?,
				es_tendencia = ?, en_oferta = ?, precio_oferta = ?, precio_por_variante = ?, activo = ?
			WHERE id = ?
		`,
		args: [
			subcategoria.categoria_id,
			subcategoria.id,
			input.nombre,
			input.slug,
			input.descripcion || null,
			input.precio_base,
			input.es_tendencia ? 1 : 0,
			input.en_oferta ? 1 : 0,
			input.en_oferta ? input.precio_oferta : 0,
			input.precio_por_variante ? 1 : 0,
			activo ? 1 : 0,
			id,
		],
	});

	await syncImagenes(id, input.imagenes, current.imagenes, current.slug, input.slug);
	await syncVariantes(id, input.slug, input.variantes);
	await syncDetalles(id, detalles);

	return getProductoById(id);
}

export async function setProductoActivo(id: string, activo: boolean) {
	const db = getDb();
	await db.execute({
		sql: `UPDATE productos SET activo = ? WHERE id = ?`,
		args: [activo ? 1 : 0, id],
	});
	return getProductoById(id);
}

export function snapshotProducto(item: Producto | ProductoListado) {
	return {
		nombre: item.nombre,
		slug: item.slug,
		categoria_id: item.categoria_id,
		categoria_nombre: item.categoria_nombre,
		subcategoria_id: item.subcategoria_id,
		subcategoria_nombre: item.subcategoria_nombre,
		precio_base: item.precio_base,
		es_tendencia: item.es_tendencia,
		en_oferta: item.en_oferta,
		precio_oferta: item.precio_oferta,
		precio_por_variante: item.precio_por_variante,
		precio_min: item.precio_min,
		precio_max: item.precio_max,
		activo: item.activo,
		stock_total: item.stock_total,
		skus: item.skus,
		imagenes: 'imagenes' in item ? item.imagenes.map((img) => ({ orden: img.orden, url: img.url })) : undefined,
		variantes:
			'variantes' in item
				? item.variantes.map((variante) => ({
						combinacion: variante.combinacion,
						stock: variante.stock,
						sku: variante.sku,
						precio: variante.precio,
					}))
				: undefined,
	};
}

export function uniqueConstraintError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return /UNIQUE/i.test(message);
}

export function knownProductoError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	if (message === 'CATEGORIA_NO_EXISTE') return 'La categoría no existe.';
	if (message === 'SUBCATEGORIA_NO_EXISTE') return 'La subcategoría no existe.';
	if (message === 'DETALLE_NUMERO') return 'Hay un dato numérico inválido en los detalles.';
	return null;
}
