import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
	console.error('Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env');
	process.exit(1);
}

const correo = (process.env.ADMIN_EMAIL || 'admin@demo.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin123';
const nombre = process.env.ADMIN_NAME || 'Administrador';

const db = createClient({ url, authToken });

const schemaPath = resolve(root, 'src/lib/db/schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

console.log('Aplicando esquema schema.sql...');
await db.executeMultiple(schema);
console.log('Esquema OK');

const existing = await db.execute({
	sql: 'SELECT id FROM usuarios_admin WHERE correo = ? LIMIT 1',
	args: [correo],
});

if (existing.rows.length > 0) {
	console.log(`Admin ya existe: ${correo}`);
} else {
	const passwordHash = await hash(password, 10);
	await db.execute({
		sql: `
			INSERT INTO usuarios_admin (id, nombre, correo, password_hash, rol, activo)
			VALUES (?, ?, ?, ?, 'admin', 1)
		`,
		args: [randomUUID(), nombre, correo, passwordHash],
	});
	console.log(`Admin creado: ${correo}`);
	console.log(`Contraseña: ${password}`);
}

const configExisting = await db.execute(
	'SELECT id FROM tienda_configuracion LIMIT 1',
);
if (configExisting.rows.length === 0) {
	await db.execute({
		sql: `
			INSERT INTO tienda_configuracion (
				id, nombre_tienda, rif, telefono, correo, direccion, horario, whatsapp
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
		args: [
			randomUUID(),
			'Demo Tienda',
			'J-00000000-0',
			'04120000000',
			'hola@demotienda.com',
			'Tu ciudad',
			'Lun–Sáb 9:00–18:00',
			'584120000000',
		],
	});
	console.log('tienda_configuracion creada');
}

const themeExisting = await db.execute(
	'SELECT id FROM tienda_personalizacion LIMIT 1',
);
if (themeExisting.rows.length === 0) {
	await db.execute({
		sql: `
			INSERT INTO tienda_personalizacion (
				id, color_primario, color_secundario, color_fondo, color_texto,
				fuente_titulos, fuente_cuerpo
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
		args: [
			randomUUID(),
			'#0f766e',
			'#ffffff',
			'#f3efe6',
			'#1c1917',
			'Poppins',
			'Inter',
		],
	});
	console.log('tienda_personalizacion creada');
}

const ping = await db.execute('SELECT COUNT(*) AS total FROM usuarios_admin');
console.log(`usuarios_admin: ${ping.rows[0].total}`);
console.log('Listo.');
