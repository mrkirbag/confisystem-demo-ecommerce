import { R2Error, getR2Env } from './env';

export type ImageKind = 'logo' | 'categoria' | 'subcategoria' | 'producto';
export type ProductSlot = 1 | 2 | 3;

export const MAX_PRODUCT_IMAGES = 3;
export const PRODUCT_SLOTS = [1, 2, 3] as const satisfies readonly ProductSlot[];

export const IMAGE_LIMITS = {
	logo: 1,
	categoria: 1,
	subcategoria: 1,
	producto: MAX_PRODUCT_IMAGES,
} as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

export function isProductSlot(value: number): value is ProductSlot {
	return value === 1 || value === 2 || value === 3;
}

export function parseProductSlot(raw: unknown): ProductSlot {
	const slot = Number(raw);
	if (!isProductSlot(slot)) {
		throw new R2Error('El producto admite como máximo 3 imágenes (ranuras 1, 2 o 3).');
	}
	return slot;
}

export function parseImageKind(raw: unknown): ImageKind {
	if (raw === 'logo' || raw === 'categoria' || raw === 'subcategoria' || raw === 'producto') {
		return raw;
	}
	throw new R2Error('Tipo de imagen inválido. Usa logo, categoria, subcategoria o producto.');
}

export function assertSlug(slug: string): string {
	const value = slug.trim().toLowerCase();
	if (!value || value.length > MAX_SLUG_LENGTH || !SLUG_RE.test(value)) {
		throw new R2Error('Slug inválido. Usa minúsculas, números y guiones.');
	}
	return value;
}

export function objectKey(input: {
	kind: ImageKind;
	slug?: string;
	parentSlug?: string;
	slot?: ProductSlot;
}): string {
	if (input.kind === 'logo') return 'logo/logo.webp';

	if (input.kind === 'categoria') {
		const slug = assertSlug(input.slug ?? '');
		return `categorias/${slug}.webp`;
	}

	if (input.kind === 'subcategoria') {
		const parent = assertSlug(input.parentSlug ?? '');
		const slug = assertSlug(input.slug ?? '');
		return `subcategorias/${parent}/${slug}.webp`;
	}

	const slug = assertSlug(input.slug ?? '');
	const slot = input.slot ?? 1;
	if (!isProductSlot(slot)) {
		throw new R2Error('El producto admite como máximo 3 imágenes (ranuras 1, 2 o 3).');
	}

	return slot === 1
		? `productos/${slug}/${slug}.webp`
		: `productos/${slug}/${slug}-${slot}.webp`;
}

export function publicUrlFor(key: string, version = Date.now()): string {
	const { publicUrl } = getR2Env();
	return `${publicUrl}/${key}?v=${version}`;
}

export function keyFromPublicUrl(url: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;

	try {
		const { publicUrl } = getR2Env();
		const parsed = new URL(trimmed);
		const base = new URL(publicUrl);
		if (parsed.origin !== base.origin) return null;

		const key = parsed.pathname.replace(/^\//, '');
		return key.length > 0 ? key : null;
	} catch {
		return null;
	}
}
