import type { APIRoute } from 'astro';
import {
	R2Error,
	parseImageKind,
	parseProductSlot,
	uploadImage,
} from '@/lib/r2';

export const prerender = false;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const POST: APIRoute = async ({ request, locals }) => {
	if (!locals.admin) return json({ error: 'No autorizado' }, 401);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'No se pudo leer el archivo.' }, 400);
	}

	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return json({ error: 'Selecciona una imagen.' }, 400);
	}

	try {
		const kind = parseImageKind(form.get('kind'));
		const slug = String(form.get('slug') ?? '');

		const result =
			kind === 'logo'
				? await uploadImage({ kind, file })
				: kind === 'categoria'
					? await uploadImage({ kind, slug, file })
					: await uploadImage({
							kind,
							slug,
							slot: parseProductSlot(form.get('slot') ?? 1),
							file,
						});

		return json({ ok: true, ...result });
	} catch (error) {
		if (error instanceof R2Error) {
			return json({ error: error.message }, error.status);
		}
		console.error('Upload error:', error);
		return json({ error: 'No se pudo subir la imagen.' }, 500);
	}
};
