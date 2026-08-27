import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';
import { getDb } from '../db';

export const ADMIN_COOKIE = 'admin_session';
const TOKEN_TTL = '7d';

export type AdminSession = {
	id: string;
	correo: string;
	nombre: string;
	rol: string;
};

type AdminRow = {
	id: string;
	nombre: string;
	correo: string;
	password_hash: string;
	rol: string;
	activo: number | boolean;
};

function getJwtSecret() {
	const secret = import.meta.env.JWT_SECRET;
	if (!secret) {
		throw new Error('Falta la variable de entorno JWT_SECRET');
	}
	return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
	return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
	return compare(password, passwordHash);
}

export async function signAdminToken(admin: AdminSession) {
	return new SignJWT({
		correo: admin.correo,
		nombre: admin.nombre,
		rol: admin.rol,
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(admin.id)
		.setIssuedAt()
		.setExpirationTime(TOKEN_TTL)
		.sign(getJwtSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
	try {
		const { payload } = await jwtVerify(token, getJwtSecret());
		if (!payload.sub || typeof payload.correo !== 'string') {
			return null;
		}

		return {
			id: payload.sub,
			correo: payload.correo,
			nombre: typeof payload.nombre === 'string' ? payload.nombre : '',
			rol: typeof payload.rol === 'string' ? payload.rol : 'admin',
		};
	} catch {
		return null;
	}
}

export function setAdminSessionCookie(cookies: AstroCookies, token: string) {
	cookies.set(ADMIN_COOKIE, token, {
		httpOnly: true,
		secure: import.meta.env.PROD,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 7,
	});
}

export function clearAdminSessionCookie(cookies: AstroCookies) {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export async function getAdminFromCookies(cookies: AstroCookies) {
	const token = cookies.get(ADMIN_COOKIE)?.value;
	if (!token) return null;
	return verifyAdminToken(token);
}

export async function findAdminByCorreo(correo: string) {
	const db = getDb();
	const result = await db.execute({
		sql: `
			SELECT id, nombre, correo, password_hash, rol, activo
			FROM usuarios_admin
			WHERE correo = ?
			LIMIT 1
		`,
		args: [correo.trim().toLowerCase()],
	});

	const row = result.rows[0] as unknown as AdminRow | undefined;
	return row ?? null;
}

export async function authenticateAdmin(correo: string, password: string) {
	const admin = await findAdminByCorreo(correo);
	if (!admin || !admin.activo) return null;

	const valid = await verifyPassword(password, admin.password_hash);
	if (!valid) return null;

	return {
		id: admin.id,
		correo: admin.correo,
		nombre: admin.nombre,
		rol: admin.rol,
	} satisfies AdminSession;
}
