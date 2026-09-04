import { copyObject, deleteObject, putObject } from './client';
import { R2Error } from './env';
import {
	assertSlug,
	keyFromPublicUrl,
	objectKey,
	parseProductSlot,
	publicUrlFor,
	type ImageKind,
	type ProductSlot,
} from './keys';
import { optimizeImage } from './optimize';

export type UploadInput =
	| { kind: 'logo'; file: File | Blob | Buffer | Uint8Array }
	| { kind: 'categoria'; slug: string; file: File | Blob | Buffer | Uint8Array }
	| {
			kind: 'subcategoria';
			slug: string;
			parentSlug: string;
			file: File | Blob | Buffer | Uint8Array;
	  }
	| {
			kind: 'producto';
			slug: string;
			slot: ProductSlot;
			file: File | Blob | Buffer | Uint8Array;
	  };

export type UploadResult = {
	kind: ImageKind;
	key: string;
	url: string;
	bytes: number;
	slug?: string;
	slot?: ProductSlot;
};

export async function uploadImage(input: UploadInput): Promise<UploadResult> {
	const slug = input.kind === 'logo' ? undefined : assertSlug(input.slug);
	const parentSlug = input.kind === 'subcategoria' ? assertSlug(input.parentSlug) : undefined;
	const slot = input.kind === 'producto' ? parseProductSlot(input.slot) : undefined;
	const key = objectKey({ kind: input.kind, slug, parentSlug, slot });
	const body = await optimizeImage(input.file, input.kind);

	await putObject({
		key,
		body,
		contentType: 'image/webp',
	});

	return {
		kind: input.kind,
		key,
		url: publicUrlFor(key),
		bytes: body.byteLength,
		slug,
		slot,
	};
}

export async function deleteImage(keyOrUrl: string) {
	const key = keyOrUrl.includes('://') ? keyFromPublicUrl(keyOrUrl) : keyOrUrl.trim();
	if (!key) return;
	await deleteObject(key);
}

export async function rekeyCategoria(oldSlug: string, newSlug: string) {
	const from = objectKey({ kind: 'categoria', slug: oldSlug });
	const to = objectKey({ kind: 'categoria', slug: newSlug });
	if (from === to) return publicUrlFor(to);

	await copyObject(from, to);
	await deleteObject(from);
	return publicUrlFor(to);
}

export async function rekeySubcategoria(
	oldParentSlug: string,
	oldSlug: string,
	newParentSlug: string,
	newSlug: string,
) {
	const from = objectKey({ kind: 'subcategoria', slug: oldSlug, parentSlug: oldParentSlug });
	const to = objectKey({ kind: 'subcategoria', slug: newSlug, parentSlug: newParentSlug });
	if (from === to) return publicUrlFor(to);

	await copyObject(from, to);
	await deleteObject(from);
	return publicUrlFor(to);
}

export async function rekeyProductoImages(
	oldSlug: string,
	newSlug: string,
	slots: ProductSlot[],
): Promise<Map<ProductSlot, string>> {
	const urls = new Map<ProductSlot, string>();
	const fromSlug = assertSlug(oldSlug);
	const toSlug = assertSlug(newSlug);

	for (const slot of slots) {
		const from = objectKey({ kind: 'producto', slug: fromSlug, slot });
		const to = objectKey({ kind: 'producto', slug: toSlug, slot });

		if (from !== to) {
			try {
				await copyObject(from, to);
				await deleteObject(from);
			} catch (error) {
				console.error(`No se pudo mover ${from} → ${to}:`, error);
				throw new R2Error('No se pudieron mover las imágenes del producto.', 500);
			}
		}

		urls.set(slot, publicUrlFor(to));
	}

	return urls;
}
