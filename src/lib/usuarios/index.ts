import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { hashPassword } from '../auth';
import { type UsuarioAdmin } from './shared';

export {
	canManageUsers,
	formatFechaUsuario,
	initialsFromName,
	type UsuarioAdmin,
} from './shared';

export type UsuarioInput = {
	nombre: string;
	correo: string;
	password?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function asText(value: unknown) {
	if (value == null) return '';
	return String(value).trim();
}

function asBool(value: unknown) {
	return value === true || value === 1 || value === '1' || value === 'on' || value === 'true';
}

function mapUsuario(row: Record<string, unknown>): UsuarioAdmin {
	return {
		id: String(row.id),
		nombre: asText(row.nombre),
		correo: asText(row.correo),
		rol: 'admin',
		activo: asBool(row.activo),
		creado_en: row.creado_en == null ? null : String(row.creado_en),
	};
}

export function sanitizeUsuarioInput(raw: Record<string, unknown>): UsuarioInput {
	const password = asText(raw.password);

	return {
		nombre: asText(raw.nombre),
		correo: asText(raw.correo).toLowerCase(),
		password: password.length > 0 ? password : undefined,
	};
}

export function validateUsuarioInput(input: UsuarioInput, options: { requirePassword: boolean }) {
	if (!input.nombre || input.nombre.length < 2) {
		return 'El nombre es obligatorio.';
	}
	if (input.nombre.length > 80) {
		return 'El nombre es demasiado largo.';
	}
	if (!input.correo || !EMAIL_RE.test(input.correo)) {
		return 'El correo no es válido.';
	}
	if (options.requirePassword && !input.password) {
		return 'La contraseña es obligatoria.';
	}
	if (input.password && input.password.length < MIN_PASSWORD) {
		return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
	}
	return null;
}

const SELECT_SAFE = `
	SELECT id, nombre, correo, rol, activo, creado_en
	FROM usuarios_admin
`;

export async function listUsuarios() {
	const db = getDb();
	const result = await db.execute(`${SELECT_SAFE} ORDER BY creado_en DESC, nombre COLLATE NOCASE`);
	return result.rows.map((row) => mapUsuario(row as Record<string, unknown>));
}

export async function getUsuarioById(id: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `${SELECT_SAFE} WHERE id = ? LIMIT 1`,
		args: [id],
	});
	const row = result.rows[0] as Record<string, unknown> | undefined;
	return row ? mapUsuario(row) : null;
}

export async function correoEnUso(correo: string, excludeId?: string) {
	const db = getDb();
	const result = await db.execute({
		sql: excludeId
			? `SELECT id FROM usuarios_admin WHERE correo = ? AND id != ? LIMIT 1`
			: `SELECT id FROM usuarios_admin WHERE correo = ? LIMIT 1`,
		args: excludeId ? [correo, excludeId] : [correo],
	});
	return result.rows.length > 0;
}

export async function createUsuario(input: UsuarioInput) {
	if (!input.password) {
		throw new Error('La contraseña es obligatoria.');
	}

	const db = getDb();
	const id = randomUUID();
	const passwordHash = await hashPassword(input.password);

	await db.execute({
		sql: `
			INSERT INTO usuarios_admin (id, nombre, correo, password_hash, rol, activo)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		args: [id, input.nombre, input.correo, passwordHash, 'admin', 1],
	});

	return getUsuarioById(id);
}

export async function updateUsuario(id: string, input: UsuarioInput) {
	const db = getDb();

	if (input.password) {
		const passwordHash = await hashPassword(input.password);
		await db.execute({
			sql: `
				UPDATE usuarios_admin
				SET nombre = ?, correo = ?, rol = 'admin', activo = 1, password_hash = ?
				WHERE id = ?
			`,
			args: [input.nombre, input.correo, passwordHash, id],
		});
	} else {
		await db.execute({
			sql: `
				UPDATE usuarios_admin
				SET nombre = ?, correo = ?, rol = 'admin', activo = 1
				WHERE id = ?
			`,
			args: [input.nombre, input.correo, id],
		});
	}

	return getUsuarioById(id);
}

async function preservarBitacora(usuarioId: string, actingAdminId: string) {
	const db = getDb();
	try {
		await db.execute({
			sql: `UPDATE bitacora_auditoria SET usuario_id = NULL WHERE usuario_id = ?`,
			args: [usuarioId],
		});
	} catch {
		await db.execute({
			sql: `UPDATE bitacora_auditoria SET usuario_id = ? WHERE usuario_id = ?`,
			args: [actingAdminId, usuarioId],
		});
	}
}

export async function deleteUsuario(id: string, actingAdminId: string) {
	const db = getDb();
	await db.execute({
		sql: `UPDATE ventas SET confirmado_por = NULL WHERE confirmado_por = ?`,
		args: [id],
	});
	await preservarBitacora(id, actingAdminId);
	await db.execute({
		sql: `DELETE FROM usuarios_admin WHERE id = ?`,
		args: [id],
	});
}

export function uniqueConstraintError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return /UNIQUE/i.test(message);
}
