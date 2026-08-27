import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import {
	isAtributoTipo,
	needsOptions,
	type Atributo,
	type AtributoOpcion,
	type AtributoTipo,
} from './shared';

export {
	ATRIBUTO_TIPOS,
	TIPO_INFO,
	isAtributoTipo,
	needsOptions,
	resumenAtributo,
	type Atributo,
	type AtributoOpcion,
	type AtributoTipo,
} from './shared';

export type AtributoInput = {
	nombre: string;
	tipo: AtributoTipo;
	opciones: string[];
};

function asText(value: unknown) {
	if (value == null) return '';
	return String(value).trim();
}

function mapOpcion(row: Record<string, unknown>): AtributoOpcion {
	return {
		id: String(row.id),
		valor: asText(row.valor),
	};
}

export function sanitizeAtributoInput(raw: Record<string, unknown>): AtributoInput {
	const opcionesRaw = Array.isArray(raw.opciones) ? raw.opciones : [];
	const seen = new Set<string>();
	const opciones: string[] = [];

	for (const item of opcionesRaw) {
		const valor = asText(item);
		const key = valor.toLowerCase();
		if (!valor || seen.has(key)) continue;
		seen.add(key);
		opciones.push(valor);
	}

	return {
		nombre: asText(raw.nombre),
		tipo: isAtributoTipo(raw.tipo) ? raw.tipo : 'seleccion_unica',
		opciones,
	};
}

export function validateAtributoInput(input: AtributoInput) {
	if (!input.nombre || input.nombre.length < 2) {
		return 'El nombre es obligatorio.';
	}
	if (input.nombre.length > 80) {
		return 'El nombre es demasiado largo.';
	}
	if (!isAtributoTipo(input.tipo)) {
		return 'Elige cómo lo usa el cliente.';
	}
	if (needsOptions(input.tipo) && input.opciones.length < 1) {
		return 'Agrega al menos una opción. Ej: S, M, L.';
	}
	return null;
}

async function loadOpciones(ids: string[]) {
	if (ids.length === 0) return new Map<string, AtributoOpcion[]>();

	const db = getDb();
	const placeholders = ids.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `
			SELECT id, atributo_id, valor
			FROM atributos_opciones
			WHERE atributo_id IN (${placeholders})
			ORDER BY valor COLLATE NOCASE
		`,
		args: ids,
	});

	const grouped = new Map<string, AtributoOpcion[]>();
	for (const raw of result.rows) {
		const row = raw as Record<string, unknown>;
		const atributoId = String(row.atributo_id);
		const list = grouped.get(atributoId) ?? [];
		list.push(mapOpcion(row));
		grouped.set(atributoId, list);
	}
	return grouped;
}

async function loadUsos(ids: string[]) {
	const counts = new Map<string, number>();
	if (ids.length === 0) return counts;

	const db = getDb();
	const placeholders = ids.map(() => '?').join(', ');
	const result = await db.execute({
		sql: `
			SELECT atributo_id, COUNT(*) AS total
			FROM producto_detalles_texto
			WHERE atributo_id IN (${placeholders})
			GROUP BY atributo_id
		`,
		args: ids,
	});

	for (const raw of result.rows) {
		const row = raw as Record<string, unknown>;
		counts.set(String(row.atributo_id), Number(row.total ?? 0));
	}
	return counts;
}

function assemble(
	rows: Record<string, unknown>[],
	opciones: Map<string, AtributoOpcion[]>,
	usos: Map<string, number>,
): Atributo[] {
	return rows.map((row) => {
		const id = String(row.id);
		const tipo = isAtributoTipo(row.tipo) ? row.tipo : 'texto';
		return {
			id,
			nombre: asText(row.nombre),
			tipo,
			opciones: needsOptions(tipo) ? (opciones.get(id) ?? []) : [],
			usos: usos.get(id) ?? 0,
		};
	});
}

export async function listAtributos() {
	const db = getDb();
	const result = await db.execute(
		`SELECT id, nombre, tipo FROM atributos_config ORDER BY nombre COLLATE NOCASE`,
	);
	const rows = result.rows as unknown as Record<string, unknown>[];
	const ids = rows.map((row) => String(row.id));
	const [opciones, usos] = await Promise.all([loadOpciones(ids), loadUsos(ids)]);
	return assemble(rows, opciones, usos);
}

export async function getAtributoById(id: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `SELECT id, nombre, tipo FROM atributos_config WHERE id = ? LIMIT 1`,
		args: [id],
	});
	const row = result.rows[0] as Record<string, unknown> | undefined;
	if (!row) return null;
	const [opciones, usos] = await Promise.all([loadOpciones([id]), loadUsos([id])]);
	return assemble([row], opciones, usos)[0] ?? null;
}

export async function nombreEnUso(nombre: string, excludeId?: string) {
	const db = getDb();
	const result = await db.execute({
		sql: excludeId
			? `SELECT id FROM atributos_config WHERE nombre = ? COLLATE NOCASE AND id != ? LIMIT 1`
			: `SELECT id FROM atributos_config WHERE nombre = ? COLLATE NOCASE LIMIT 1`,
		args: excludeId ? [nombre, excludeId] : [nombre],
	});
	return result.rows.length > 0;
}

async function saveOpciones(atributoId: string, tipo: AtributoTipo, opciones: string[]) {
	const db = getDb();
	await db.execute({
		sql: `DELETE FROM atributos_opciones WHERE atributo_id = ?`,
		args: [atributoId],
	});

	if (!needsOptions(tipo)) return;

	for (const valor of opciones) {
		await db.execute({
			sql: `INSERT INTO atributos_opciones (id, atributo_id, valor) VALUES (?, ?, ?)`,
			args: [randomUUID(), atributoId, valor],
		});
	}
}

export async function createAtributo(input: AtributoInput) {
	const db = getDb();
	const id = randomUUID();

	await db.execute({
		sql: `INSERT INTO atributos_config (id, nombre, tipo) VALUES (?, ?, ?)`,
		args: [id, input.nombre, input.tipo],
	});
	await saveOpciones(id, input.tipo, input.opciones);
	return getAtributoById(id);
}

export async function updateAtributo(id: string, input: AtributoInput) {
	const db = getDb();
	await db.execute({
		sql: `UPDATE atributos_config SET nombre = ?, tipo = ? WHERE id = ?`,
		args: [input.nombre, input.tipo, id],
	});
	await saveOpciones(id, input.tipo, input.opciones);
	return getAtributoById(id);
}

export async function deleteAtributo(id: string) {
	const db = getDb();
	await db.execute({
		sql: `DELETE FROM atributos_config WHERE id = ?`,
		args: [id],
	});
}

export function snapshotAtributo(item: Atributo) {
	return {
		nombre: item.nombre,
		tipo: item.tipo,
		opciones: item.opciones.map((opcion) => opcion.valor),
	};
}

export function uniqueConstraintError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return /UNIQUE/i.test(message);
}
