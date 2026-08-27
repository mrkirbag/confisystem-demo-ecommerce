import { randomUUID } from 'node:crypto';
import { getDb } from '../db';

export type TiendaConfig = {
	id: string;
	nombre_tienda: string | null;
	logo_url: string | null;
	whatsapp: string | null;
};

export type TiendaConfiguracion = {
	id: string;
	nombre_tienda: string | null;
	rif: string | null;
	telefono: string | null;
	correo: string | null;
	direccion: string | null;
	horario: string | null;
	instagram: string | null;
	tiktok: string | null;
	whatsapp: string | null;
	logo_url: string | null;
	google_analytics: string | null;
};

export type TiendaConfiguracionInput = Omit<TiendaConfiguracion, 'id'>;

export type TiendaPersonalizacion = {
	id: string;
	color_primario: string;
	color_secundario: string;
	color_fondo: string;
	color_texto: string;
	fuente_titulos: string;
	fuente_cuerpo: string;
};

export type TiendaPersonalizacionInput = Omit<TiendaPersonalizacion, 'id'>;

export const FONT_OPTIONS = [
	'Inter',
	'Poppins',
	'Montserrat',
	'Outfit',
	'Nunito',
	'DM Sans',
	'Space Grotesk',
	'Roboto',
	'Playfair Display',
	'Lora',
	'Merriweather',
] as const;

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string) {
	const hex = value.trim();
	const short = hex.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
	if (short) {
		return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
	}
	return hex.toLowerCase();
}

export const DEFAULT_PERSONALIZACION: TiendaPersonalizacion = {
	id: 'default',
	color_primario: '#0f766e',
	color_secundario: '#ffffff',
	color_fondo: '#f3efe6',
	color_texto: '#1c1917',
	fuente_titulos: 'Poppins',
	fuente_cuerpo: 'Inter',
};

export const DEFAULT_CONFIG: TiendaConfig = {
	id: 'default',
	nombre_tienda: 'Demo Tienda',
	logo_url: null,
	whatsapp: null,
};

export const EMPTY_TIENDA_FORM: TiendaConfiguracionInput = {
	nombre_tienda: '',
	rif: '',
	telefono: '',
	correo: '',
	direccion: '',
	horario: '',
	instagram: '',
	tiktok: '',
	whatsapp: '',
	logo_url: '',
	google_analytics: '',
};

function asText(value: unknown) {
	if (value == null) return null;
	const text = String(value).trim();
	return text.length > 0 ? text : null;
}

function mapConfiguracion(row: Record<string, unknown>): TiendaConfiguracion {
	return {
		id: String(row.id),
		nombre_tienda: asText(row.nombre_tienda),
		rif: asText(row.rif),
		telefono: asText(row.telefono),
		correo: asText(row.correo),
		direccion: asText(row.direccion),
		horario: asText(row.horario),
		instagram: asText(row.instagram),
		tiktok: asText(row.tiktok),
		whatsapp: asText(row.whatsapp),
		logo_url: asText(row.logo_url),
		google_analytics: asText(row.google_analytics),
	};
}

export function sanitizeTiendaInput(raw: Record<string, unknown>): TiendaConfiguracionInput {
	return {
		nombre_tienda: asText(raw.nombre_tienda),
		rif: asText(raw.rif),
		telefono: asText(raw.telefono),
		correo: asText(raw.correo)?.toLowerCase() ?? null,
		direccion: asText(raw.direccion),
		horario: asText(raw.horario),
		instagram: asText(raw.instagram),
		tiktok: asText(raw.tiktok),
		whatsapp: asText(raw.whatsapp)?.replace(/[^\d+]/g, '') ?? null,
		logo_url: asText(raw.logo_url),
		google_analytics: asText(raw.google_analytics),
	};
}

export function validateTiendaInput(input: TiendaConfiguracionInput) {
	if (!input.nombre_tienda) {
		return 'El nombre de la tienda es obligatorio.';
	}

	if (input.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.correo)) {
		return 'El correo no es válido.';
	}

	return null;
}

export async function getTiendaConfig(): Promise<TiendaConfig> {
	try {
		const db = getDb();
		const result = await db.execute(`
			SELECT id, nombre_tienda, logo_url, whatsapp
			FROM tienda_configuracion
			ORDER BY nombre_tienda COLLATE NOCASE
			LIMIT 1
		`);
		const row = result.rows[0];
		if (!row) return DEFAULT_CONFIG;

		return {
			id: String(row.id),
			nombre_tienda: (row.nombre_tienda as string | null) ?? DEFAULT_CONFIG.nombre_tienda,
			logo_url: (row.logo_url as string | null) ?? null,
			whatsapp: (row.whatsapp as string | null) ?? null,
		};
	} catch {
		return DEFAULT_CONFIG;
	}
}

const CONFIG_SELECT = `
	SELECT
		id, nombre_tienda, rif, telefono, correo, direccion, horario,
		instagram, tiktok, whatsapp, logo_url, google_analytics
	FROM tienda_configuracion
	LIMIT 1
`;

export async function getTiendaConfiguracion() {
	const db = getDb();
	const result = await db.execute(CONFIG_SELECT);
	const row = result.rows[0] as Record<string, unknown> | undefined;
	return row ? mapConfiguracion(row) : null;
}

export async function saveTiendaConfiguracion(input: TiendaConfiguracionInput) {
	const db = getDb();
	const current = await getTiendaConfiguracion();
	const logoUrl = input.logo_url || current?.logo_url || null;

	if (current) {
		await db.execute({
			sql: `
				UPDATE tienda_configuracion
				SET
					nombre_tienda = ?,
					rif = ?,
					telefono = ?,
					correo = ?,
					direccion = ?,
					horario = ?,
					instagram = ?,
					tiktok = ?,
					whatsapp = ?,
					logo_url = ?,
					google_analytics = ?
				WHERE id = ?
			`,
			args: [
				input.nombre_tienda,
				input.rif,
				input.telefono,
				input.correo,
				input.direccion,
				input.horario,
				input.instagram,
				input.tiktok,
				input.whatsapp,
				logoUrl,
				input.google_analytics,
				current.id,
			],
		});

		return getTiendaConfiguracion();
	}

	const id = randomUUID();
	await db.execute({
		sql: `
			INSERT INTO tienda_configuracion (
				id, nombre_tienda, rif, telefono, correo, direccion, horario,
				instagram, tiktok, whatsapp, logo_url, google_analytics
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
		args: [
			id,
			input.nombre_tienda,
			input.rif,
			input.telefono,
			input.correo,
			input.direccion,
			input.horario,
			input.instagram,
			input.tiktok,
			input.whatsapp,
			logoUrl,
			input.google_analytics,
		],
	});

	return getTiendaConfiguracion();
}

export async function getTiendaPersonalizacion(): Promise<TiendaPersonalizacion> {
	try {
		const db = getDb();
		const result = await db.execute(`
			SELECT
				id,
				color_primario,
				color_secundario,
				color_fondo,
				color_texto,
				fuente_titulos,
				fuente_cuerpo
			FROM tienda_personalizacion
			LIMIT 1
		`);
		const row = result.rows[0];
		if (!row) return DEFAULT_PERSONALIZACION;

		return {
			id: String(row.id),
			color_primario: String(row.color_primario || DEFAULT_PERSONALIZACION.color_primario),
			color_secundario: String(row.color_secundario || DEFAULT_PERSONALIZACION.color_secundario),
			color_fondo: String(row.color_fondo || DEFAULT_PERSONALIZACION.color_fondo),
			color_texto: String(row.color_texto || DEFAULT_PERSONALIZACION.color_texto),
			fuente_titulos: String(row.fuente_titulos || DEFAULT_PERSONALIZACION.fuente_titulos),
			fuente_cuerpo: String(row.fuente_cuerpo || DEFAULT_PERSONALIZACION.fuente_cuerpo),
		};
	} catch {
		return DEFAULT_PERSONALIZACION;
	}
}

export function sanitizePersonalizacionInput(raw: Record<string, unknown>): TiendaPersonalizacionInput {
	const fontTitulos = asText(raw.fuente_titulos) || DEFAULT_PERSONALIZACION.fuente_titulos;
	const fontCuerpo = asText(raw.fuente_cuerpo) || DEFAULT_PERSONALIZACION.fuente_cuerpo;

	return {
		color_primario: asText(raw.color_primario) || DEFAULT_PERSONALIZACION.color_primario,
		color_secundario: asText(raw.color_secundario) || DEFAULT_PERSONALIZACION.color_secundario,
		color_fondo: asText(raw.color_fondo) || DEFAULT_PERSONALIZACION.color_fondo,
		color_texto: asText(raw.color_texto) || DEFAULT_PERSONALIZACION.color_texto,
		fuente_titulos: fontTitulos,
		fuente_cuerpo: fontCuerpo,
	};
}

export function validatePersonalizacionInput(input: TiendaPersonalizacionInput) {
	const colors = [
		['primario', input.color_primario],
		['secundario', input.color_secundario],
		['fondo', input.color_fondo],
		['texto', input.color_texto],
	] as const;

	for (const [label, value] of colors) {
		if (!HEX_COLOR.test(value)) {
			return `El color ${label} no es un hexadecimal válido.`;
		}
	}

	const allowed = new Set<string>(FONT_OPTIONS);
	if (!allowed.has(input.fuente_titulos) || !allowed.has(input.fuente_cuerpo)) {
		return 'Selecciona una fuente válida.';
	}

	return null;
}

export async function saveTiendaPersonalizacion(input: TiendaPersonalizacionInput) {
	const db = getDb();
	const current = await db.execute(`SELECT id FROM tienda_personalizacion LIMIT 1`);
	const colors = {
		color_primario: normalizeHex(input.color_primario),
		color_secundario: normalizeHex(input.color_secundario),
		color_fondo: normalizeHex(input.color_fondo),
		color_texto: normalizeHex(input.color_texto),
	};

	const existingId = current.rows[0]?.id ? String(current.rows[0].id) : null;

	if (existingId) {
		await db.execute({
			sql: `
				UPDATE tienda_personalizacion
				SET
					color_primario = ?,
					color_secundario = ?,
					color_fondo = ?,
					color_texto = ?,
					fuente_titulos = ?,
					fuente_cuerpo = ?
				WHERE id = ?
			`,
			args: [
				colors.color_primario,
				colors.color_secundario,
				colors.color_fondo,
				colors.color_texto,
				input.fuente_titulos,
				input.fuente_cuerpo,
				existingId,
			],
		});
	} else {
		await db.execute({
			sql: `
				INSERT INTO tienda_personalizacion (
					id, color_primario, color_secundario, color_fondo, color_texto,
					fuente_titulos, fuente_cuerpo
				) VALUES (?, ?, ?, ?, ?, ?, ?)
			`,
			args: [
				randomUUID(),
				colors.color_primario,
				colors.color_secundario,
				colors.color_fondo,
				colors.color_texto,
				input.fuente_titulos,
				input.fuente_cuerpo,
			],
		});
	}

	return getTiendaPersonalizacion();
}

export function googleFontsHref(titulos: string, cuerpo: string) {
	const families = [...new Set([titulos, cuerpo])]
		.filter(Boolean)
		.map((name) => `family=${name.trim().replace(/\s+/g, '+')}:wght@400;500;600;700`)
		.join('&');

	return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function hexLuminance(hex: string) {
	const raw = hex.replace('#', '');
	const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
	const n = Number.parseInt(full, 16);
	if (Number.isNaN(n) || full.length !== 6) return 0;
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(a: number, b: number) {
	const light = Math.max(a, b) + 0.05;
	const dark = Math.min(a, b) + 0.05;
	return light / dark;
}

function readableOn(background: string, preferred: string) {
	const bg = hexLuminance(background);
	const fg = hexLuminance(preferred);
	if (contrastRatio(bg, fg) >= 4.5) return preferred;
	return bg > 0.45 ? '#1c1917' : '#ffffff';
}

export function themeStyleVars(theme: TiendaPersonalizacion): string {
	const titulo = theme.fuente_titulos.replace(/['"]/g, '');
	const cuerpo = theme.fuente_cuerpo.replace(/['"]/g, '');
	const primario = theme.color_primario;
	const secundario = theme.color_secundario;
	const fondo = theme.color_fondo;
	const texto = theme.color_texto;
	const inkOnBg = readableOn(fondo, texto);
	const inkOnPanel = readableOn(secundario, texto);
	const accentInk = hexLuminance(primario) > 0.55 ? '#1c1917' : '#ffffff';

	return [
		`--color-primario: ${primario}`,
		`--color-secundario: ${secundario}`,
		`--color-fondo: ${fondo}`,
		`--color-texto: ${texto}`,
		`--bg: ${fondo}`,
		`--ink: ${inkOnBg}`,
		`--ink-on-panel: ${inkOnPanel}`,
		`--panel: ${secundario}`,
		`--accent: ${primario}`,
		`--accent-ink: ${accentInk}`,
		`--muted: ${inkOnBg}`,
		`--muted-on-panel: ${inkOnPanel}`,
		`--line: color-mix(in srgb, ${inkOnBg} 16%, ${fondo})`,
		`--line-on-panel: color-mix(in srgb, ${inkOnPanel} 16%, ${secundario})`,
		`--danger-ink-on-panel: ${readableOn(secundario, '#b91c1c')}`,
		`--font-titulos: '${titulo}', var(--font-sans)`,
		`--font-cuerpo: '${cuerpo}', var(--font-sans)`,
	].join('; ');
}
