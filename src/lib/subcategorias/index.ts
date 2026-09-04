import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { deleteImage, rekeySubcategoria } from '../r2';
import { isValidSlug, type Subcategoria } from './shared';

export {
	initialsFromName,
	isValidSlug,
	slugify,
	type Subcategoria,
} from './shared';

export type SubcategoriaInput = {
	categoria_id: string;
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

async function tableExists(table: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
		args: [table],
	});
	return result.rows.length > 0;
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

export async function ensureSubcategoriaSchema() {
	if (!schemaReady) {
		schemaReady = (async () => {
			const db = getDb();

			if (!(await tableExists('subcategorias'))) {
				await db.execute(`
					CREATE TABLE subcategorias (
						id TEXT PRIMARY KEY,
						categoria_id TEXT NOT NULL,
						nombre TEXT NOT NULL,
						slug TEXT NOT NULL,
						imagen_url TEXT,
						orden INTEGER DEFAULT 0,
						activo BOOLEAN DEFAULT 1,
						FOREIGN KEY (categoria_id) REFERENCES categorias(id),
						UNIQUE (categoria_id, slug)
					)
				`);
			}

			await db.execute(
				`CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON subcategorias(categoria_id)`,
			);
			await db.execute(
				`CREATE INDEX IF NOT EXISTS idx_subcategorias_activo ON subcategorias(activo)`,
			);

			if (!(await tableHasColumn('productos', 'subcategoria_id'))) {
				await addColumn(`ALTER TABLE productos ADD COLUMN subcategoria_id TEXT`);
			}

			await db.execute(
				`CREATE INDEX IF NOT EXISTS idx_productos_subcategoria ON productos(subcategoria_id)`,
			);
		})();
	}

	await schemaReady;
}

function mapSubcategoria(row: Record<string, unknown>): Subcategoria {
	return {
		id: String(row.id),
		categoria_id: String(row.categoria_id),
		categoria_nombre: asText(row.categoria_nombre),
		categoria_slug: asText(row.categoria_slug),
		nombre: asText(row.nombre),
		slug: asText(row.slug),
		imagen_url: row.imagen_url == null || row.imagen_url === '' ? null : String(row.imagen_url),
		orden: asOrden(row.orden),
		activo: asBool(row.activo),
		productos: Number(row.productos ?? 0),
	};
}

export function sanitizeSubcategoriaInput(raw: Record<string, unknown>): SubcategoriaInput {
	const imagen = asText(raw.imagen_url);
	const activo = raw.activo;

	return {
		categoria_id: asText(raw.categoria_id),
		nombre: asText(raw.nombre),
		slug: asText(raw.slug).toLowerCase(),
		imagen_url: imagen.length > 0 ? imagen : null,
		activo: activo == null ? undefined : asBool(activo),
	};
}

export function validateSubcategoriaInput(input: SubcategoriaInput) {
	if (!input.categoria_id) return 'Elige una categoría.';
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
		s.id, s.categoria_id, s.nombre, s.slug, s.imagen_url, s.orden, s.activo,
		c.nombre AS categoria_nombre,
		c.slug AS categoria_slug,
		(SELECT COUNT(*) FROM productos WHERE subcategoria_id = s.id) AS productos
	FROM subcategorias s
	INNER JOIN categorias c ON c.id = s.categoria_id
`;

export async function listSubcategorias(categoriaId?: string) {
	await ensureSubcategoriaSchema();
	const db = getDb();
	const result = categoriaId
		? await db.execute({
				sql: `${SELECT_SAFE} WHERE s.categoria_id = ? ORDER BY s.nombre COLLATE NOCASE`,
				args: [categoriaId],
			})
		: await db.execute(`${SELECT_SAFE} ORDER BY c.nombre COLLATE NOCASE, s.nombre COLLATE NOCASE`);
	return result.rows.map((row) => mapSubcategoria(row as Record<string, unknown>));
}

export async function getSubcategoriaById(id: string) {
	await ensureSubcategoriaSchema();
	const db = getDb();
	const result = await db.execute({
		sql: `${SELECT_SAFE} WHERE s.id = ? LIMIT 1`,
		args: [id],
	});
	const row = result.rows[0] as Record<string, unknown> | undefined;
	return row ? mapSubcategoria(row) : null;
}

export async function slugEnUso(slug: string, categoriaId: string, excludeId?: string) {
	await ensureSubcategoriaSchema();
	const db = getDb();
	const result = await db.execute({
		sql: excludeId
			? `SELECT id FROM subcategorias WHERE slug = ? AND categoria_id = ? AND id != ? LIMIT 1`
			: `SELECT id FROM subcategorias WHERE slug = ? AND categoria_id = ? LIMIT 1`,
		args: excludeId ? [slug, categoriaId, excludeId] : [slug, categoriaId],
	});
	return result.rows.length > 0;
}

export async function countProductosBySubcategoria(id: string) {
	await ensureSubcategoriaSchema();
	const db = getDb();
	const result = await db.execute({
		sql: `SELECT COUNT(*) AS total FROM productos WHERE subcategoria_id = ?`,
		args: [id],
	});
	return Number((result.rows[0] as { total?: number } | undefined)?.total ?? 0);
}

export async function countSubcategoriasByCategoria(id: string) {
	await ensureSubcategoriaSchema();
	const db = getDb();
	const result = await db.execute({
		sql: `SELECT COUNT(*) AS total FROM subcategorias WHERE categoria_id = ?`,
		args: [id],
	});
	return Number((result.rows[0] as { total?: number } | undefined)?.total ?? 0);
}

async function getCategoriaSlug(categoriaId: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `SELECT slug FROM categorias WHERE id = ? LIMIT 1`,
		args: [categoriaId],
	});
	const slug = asText((result.rows[0] as Record<string, unknown> | undefined)?.slug);
	if (!slug) throw new Error('CATEGORIA_NO_EXISTE');
	return slug;
}

export async function createSubcategoria(input: SubcategoriaInput) {
	await ensureSubcategoriaSchema();
	await getCategoriaSlug(input.categoria_id);
	const db = getDb();
	const id = randomUUID();

	await db.execute({
		sql: `
			INSERT INTO subcategorias (id, categoria_id, nombre, slug, imagen_url, orden, activo)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
		args: [id, input.categoria_id, input.nombre, input.slug, input.imagen_url ?? null, 0, 1],
	});

	return getSubcategoriaById(id);
}

export async function updateSubcategoria(id: string, input: SubcategoriaInput) {
	await ensureSubcategoriaSchema();
	const current = await getSubcategoriaById(id);
	if (!current) return null;

	const parentTo = await getCategoriaSlug(input.categoria_id);
	let imagenUrl = input.imagen_url === undefined ? current.imagen_url : input.imagen_url;
	const slugChanged = input.slug !== current.slug;
	const parentChanged = input.categoria_id !== current.categoria_id;
	const parentFrom = current.categoria_slug;

	if ((slugChanged || parentChanged) && current.imagen_url) {
		if (!imagenUrl || imagenUrl === current.imagen_url) {
			try {
				imagenUrl = await rekeySubcategoria(parentFrom, current.slug, parentTo, input.slug);
			} catch (error) {
				console.error('No se pudo mover la imagen de subcategoría:', error);
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
			UPDATE subcategorias
			SET categoria_id = ?, nombre = ?, slug = ?, imagen_url = ?, activo = ?
			WHERE id = ?
		`,
		args: [input.categoria_id, input.nombre, input.slug, imagenUrl, activo ? 1 : 0, id],
	});

	if (parentChanged) {
		await db.execute({
			sql: `UPDATE productos SET categoria_id = ? WHERE subcategoria_id = ?`,
			args: [input.categoria_id, id],
		});
	}

	return getSubcategoriaById(id);
}

export async function setSubcategoriaActivo(id: string, activo: boolean) {
	await ensureSubcategoriaSchema();
	const db = getDb();
	await db.execute({
		sql: `UPDATE subcategorias SET activo = ? WHERE id = ?`,
		args: [activo ? 1 : 0, id],
	});
	return getSubcategoriaById(id);
}

export async function rekeyImagenesPorCambioCategoria(
	categoriaId: string,
	oldParentSlug: string,
	newParentSlug: string,
) {
	if (oldParentSlug === newParentSlug) return;
	await ensureSubcategoriaSchema();
	const db = getDb();
	const result = await db.execute({
		sql: `
			SELECT id, slug, imagen_url
			FROM subcategorias
			WHERE categoria_id = ?
				AND imagen_url IS NOT NULL
				AND TRIM(imagen_url) != ''
		`,
		args: [categoriaId],
	});

	for (const raw of result.rows) {
		const row = raw as Record<string, unknown>;
		try {
			const url = await rekeySubcategoria(
				oldParentSlug,
				asText(row.slug),
				newParentSlug,
				asText(row.slug),
			);
			await db.execute({
				sql: `UPDATE subcategorias SET imagen_url = ? WHERE id = ?`,
				args: [url, String(row.id)],
			});
		} catch (error) {
			console.error('No se pudo mover la imagen de subcategoría:', error);
		}
	}
}

export function snapshotSubcategoria(item: Subcategoria) {
	return {
		categoria_id: item.categoria_id,
		categoria_nombre: item.categoria_nombre,
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

export function knownSubcategoriaError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	if (message === 'CATEGORIA_NO_EXISTE') return 'La categoría no existe.';
	return null;
}
