import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { deleteImage, rekeyCategoria } from '../r2';
import {
	isValidSlug,
	type Categoria,
} from './shared';

export {
	initialsFromName,
	isValidSlug,
	slugify,
	type Categoria,
} from './shared';

export type CategoriaInput = {
	nombre: string;
	slug: string;
	imagen_url?: string | null;
	activo?: boolean;
};

function asText(value: unknown) {
	if (value == null) return '';
	return String(value).trim();
}

function asBool(value: unknown) {
	return value === true || value === 1 || value === '1' || value === 'on' || value === 'true';
}

function asOrden(value: unknown) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(9999, Math.round(n)));
}

function mapCategoria(row: Record<string, unknown>): Categoria {
	return {
		id: String(row.id),
		nombre: asText(row.nombre),
		slug: asText(row.slug),
		imagen_url: row.imagen_url == null || row.imagen_url === '' ? null : String(row.imagen_url),
		orden: asOrden(row.orden),
		activo: asBool(row.activo),
		productos: Number(row.productos ?? 0),
	};
}

export function sanitizeCategoriaInput(raw: Record<string, unknown>): CategoriaInput {
	const imagen = asText(raw.imagen_url);
	const activo = raw.activo;

	return {
		nombre: asText(raw.nombre),
		slug: asText(raw.slug).toLowerCase(),
		imagen_url: imagen.length > 0 ? imagen : null,
		activo: activo == null ? undefined : asBool(activo),
	};
}

export function validateCategoriaInput(input: CategoriaInput) {
	if (!input.nombre || input.nombre.length < 2) {
		return 'El nombre es obligatorio.';
	}
	if (input.nombre.length > 80) {
		return 'El nombre es demasiado largo.';
	}
	if (!isValidSlug(input.slug)) {
		return 'El slug no es válido. Usa minúsculas, números y guiones.';
	}
	return null;
}

const SELECT_SAFE = `
	SELECT
		id, nombre, slug, imagen_url, orden, activo,
		(SELECT COUNT(*) FROM productos WHERE categoria_id = categorias.id) AS productos
	FROM categorias
`;

export async function listCategorias() {
	const db = getDb();
	const result = await db.execute(
		`${SELECT_SAFE} ORDER BY nombre COLLATE NOCASE`,
	);
	return result.rows.map((row) => mapCategoria(row as Record<string, unknown>));
}

export async function getCategoriaById(id: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `${SELECT_SAFE} WHERE id = ? LIMIT 1`,
		args: [id],
	});
	const row = result.rows[0] as Record<string, unknown> | undefined;
	return row ? mapCategoria(row) : null;
}

export async function slugEnUso(slug: string, excludeId?: string) {
	const db = getDb();
	const result = await db.execute({
		sql: excludeId
			? `SELECT id FROM categorias WHERE slug = ? AND id != ? LIMIT 1`
			: `SELECT id FROM categorias WHERE slug = ? LIMIT 1`,
		args: excludeId ? [slug, excludeId] : [slug],
	});
	return result.rows.length > 0;
}

export async function countProductosByCategoria(id: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `SELECT COUNT(*) AS total FROM productos WHERE categoria_id = ?`,
		args: [id],
	});
	return Number((result.rows[0] as { total?: number } | undefined)?.total ?? 0);
}

export async function createCategoria(input: CategoriaInput) {
	const db = getDb();
	const id = randomUUID();

	await db.execute({
		sql: `
			INSERT INTO categorias (id, nombre, slug, imagen_url, orden, activo)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		args: [id, input.nombre, input.slug, input.imagen_url ?? null, 0, 1],
	});

	return getCategoriaById(id);
}

export async function updateCategoria(id: string, input: CategoriaInput) {
	const current = await getCategoriaById(id);
	if (!current) return null;

	let imagenUrl = input.imagen_url === undefined ? current.imagen_url : input.imagen_url;
	const slugChanged = input.slug !== current.slug;

	if (slugChanged && current.imagen_url) {
		if (!imagenUrl || imagenUrl === current.imagen_url) {
			try {
				imagenUrl = await rekeyCategoria(current.slug, input.slug);
			} catch (error) {
				console.error('No se pudo mover la imagen de categoría:', error);
			}
		} else {
			try {
				await deleteImage(current.imagen_url);
			} catch (error) {
				console.error('No se pudo borrar la imagen anterior:', error);
			}
		}
	}

	const activo = input.activo == null ? current.activo : input.activo;

	const db = getDb();
	await db.execute({
		sql: `
			UPDATE categorias
			SET nombre = ?, slug = ?, imagen_url = ?, activo = ?
			WHERE id = ?
		`,
		args: [input.nombre, input.slug, imagenUrl, activo ? 1 : 0, id],
	});

	return getCategoriaById(id);
}

export async function setCategoriaActivo(id: string, activo: boolean) {
	const db = getDb();
	await db.execute({
		sql: `UPDATE categorias SET activo = ? WHERE id = ?`,
		args: [activo ? 1 : 0, id],
	});
	return getCategoriaById(id);
}

export function snapshotCategoria(item: Categoria) {
	return {
		nombre: item.nombre,
		slug: item.slug,
		imagen_url: item.imagen_url,
		activo: item.activo,
	};
}

export function uniqueConstraintError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return /UNIQUE/i.test(message);
}
