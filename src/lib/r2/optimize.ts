import sharp from 'sharp';
import { R2Error } from './env';
import type { ImageKind } from './keys';

export const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/avif',
]);

const ALLOWED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif']);

const PRESETS: Record<ImageKind, { max: number; quality: number }> = {
	logo: { max: 512, quality: 78 },
	categoria: { max: 1200, quality: 72 },
	producto: { max: 1600, quality: 72 },
};

async function toBuffer(input: File | Blob | Buffer | Uint8Array): Promise<Buffer> {
	if (Buffer.isBuffer(input)) return input;
	if (input instanceof Uint8Array) return Buffer.from(input);
	return Buffer.from(await input.arrayBuffer());
}

function mimeOf(input: File | Blob | Buffer | Uint8Array): string {
	if (typeof File !== 'undefined' && input instanceof File) return input.type;
	if (typeof Blob !== 'undefined' && input instanceof Blob) return input.type;
	return '';
}

export async function optimizeImage(
	input: File | Blob | Buffer | Uint8Array,
	kind: ImageKind,
): Promise<Buffer> {
	const mime = mimeOf(input);
	if (mime && !ALLOWED_MIME.has(mime)) {
		throw new R2Error('Formato no permitido. Usa JPG, PNG, WebP o AVIF.');
	}

	const original = await toBuffer(input);
	if (original.byteLength === 0) {
		throw new R2Error('El archivo está vacío.');
	}
	if (original.byteLength > MAX_ORIGINAL_BYTES) {
		throw new R2Error('La imagen supera el máximo de 5 MB.');
	}

	try {
		const meta = await sharp(original, { failOn: 'error', animated: false }).metadata();
		if (meta.format && !ALLOWED_FORMATS.has(meta.format)) {
			throw new R2Error('Formato no permitido. Usa JPG, PNG, WebP o AVIF.');
		}
	} catch (error) {
		if (error instanceof R2Error) throw error;
		throw new R2Error('El archivo no es una imagen válida.');
	}

	const preset = PRESETS[kind];

	try {
		return await sharp(original, { failOn: 'error', animated: false })
			.rotate()
			.resize(preset.max, preset.max, {
				fit: 'inside',
				withoutEnlargement: true,
			})
			.webp({
				quality: preset.quality,
				effort: 6,
				smartSubsample: true,
				alphaQuality: kind === 'logo' ? 90 : 80,
			})
			.toBuffer();
	} catch {
		throw new R2Error('No se pudo optimizar la imagen.');
	}
}
