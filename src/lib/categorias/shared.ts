export type Categoria = {
	id: string;
	nombre: string;
	slug: string;
	imagen_url: string | null;
	orden: number;
	activo: boolean;
	productos: number;
	subcategorias: number;
};

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;

export function slugify(value: string) {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LENGTH);
}

export function isValidSlug(value: string) {
	return SLUG_RE.test(value) && value.length > 0 && value.length <= MAX_SLUG_LENGTH;
}

export function initialsFromName(nombre: string) {
	const parts = nombre.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return 'C';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
