import { useState, type FormEvent } from 'react';
import { isValidSlug, slugify, type Categoria } from '@/lib/categorias/shared';
import ImageUpload from '../crud/ImageUpload';

type Props = {
	mode: 'create' | 'edit';
	values?: Pick<Categoria, 'nombre' | 'slug' | 'imagen_url'>;
	categoriaId?: string;
	canDeactivate?: boolean;
	onCancel: () => void;
	onSaved: (item: Categoria) => void;
	onDeactivate?: () => void;
};

type ApiResponse = {
	error?: string;
	item?: Categoria;
};

export default function CategoriaForm({
	mode,
	values,
	categoriaId,
	canDeactivate = false,
	onCancel,
	onSaved,
	onDeactivate,
}: Props) {
	const [nombre, setNombre] = useState(values?.nombre ?? '');
	const slug = slugify(nombre.trim());
	const [imagenUrl, setImagenUrl] = useState(values?.imagen_url ?? null);
	const [file, setFile] = useState<File | null>(null);
	const [fileName, setFileName] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submitLabel = mode === 'create' ? 'Crear categoría' : 'Guardar cambios';

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError('');

		const nombreTrim = nombre.trim();
		const slugTrim = slug;

		if (nombreTrim.length < 2) {
			setError('El nombre es obligatorio.');
			return;
		}
		if (!isValidSlug(slugTrim)) {
			setError('El slug no es válido. Usa minúsculas, números y guiones.');
			return;
		}

		setLoading(true);

		try {
			let nextImagen = imagenUrl;

			if (file) {
				const uploadData = new FormData();
				uploadData.append('kind', 'categoria');
				uploadData.append('slug', slugTrim);
				uploadData.append('file', file);

				const uploaded = await fetch('/api/admin/upload', {
					method: 'POST',
					headers: { Accept: 'application/json' },
					body: uploadData,
				});
				const body = (await uploaded.json().catch(() => ({}))) as { error?: string; url?: string };
				if (!uploaded.ok || !body.url) {
					setError(body.error || 'No se pudo subir la imagen.');
					setLoading(false);
					return;
				}
				nextImagen = body.url;
				setImagenUrl(body.url);
			}

			const endpoint =
				mode === 'create' ? '/api/admin/categorias' : `/api/admin/categorias/${categoriaId}`;
			const response = await fetch(endpoint, {
				method: mode === 'create' ? 'POST' : 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					nombre: nombreTrim,
					slug: slugTrim,
					imagen_url: nextImagen,
				}),
			});

			const payload = (await response.json().catch(() => ({}))) as ApiResponse;
			if (!response.ok || !payload.item) {
				setError(payload.error || 'No se pudo guardar.');
				setLoading(false);
				return;
			}

			onSaved(payload.item);
		} catch {
			setError('No se pudo guardar. Revisa la conexión.');
			setLoading(false);
		}
	}

	return (
		<>
			<form className="admin-form admin-form--stack" onSubmit={handleSubmit} noValidate>
				{error ? (
					<div className="admin-form__alert is-visible" role="alert">
						{error}
					</div>
				) : null}

				<div className="admin-form__grid">
					<label className="admin-form__field admin-form__field--full">
						Nombre
						<input
							className="admin-form__input"
							type="text"
							required
							minLength={2}
							maxLength={80}
							autoFocus
							value={nombre}
							onChange={(event) => setNombre(event.target.value)}
						/>
						<span className="admin-form__hint">
							Slug: <strong>{slug || '—'}</strong>
						</span>
					</label>

					<ImageUpload
						hint="Imagen horizontal (formato apaisado, ej. 16:9 · 1200×675 px) · JPG, PNG, WebP o AVIF · máx. 5 MB"
						previewUrl={imagenUrl}
						fileName={fileName}
						disabled={loading}
						onFile={(next) => {
							setFile(next);
							setFileName(next.name);
						}}
					/>
				</div>

				<div className="admin-form__actions">
					<button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel} disabled={loading}>
						Cancelar
					</button>
					<button type="submit" className="admin-btn admin-btn--primary" disabled={loading} aria-busy={loading}>
						{loading ? 'Guardando…' : submitLabel}
					</button>
				</div>
			</form>

			{mode === 'edit' && canDeactivate && onDeactivate ? (
				<div className="admin-danger">
					<h3 className="admin-danger__title">Eliminar categoría</h3>
					<p className="admin-danger__text">
						Sale del listado y de la tienda. Puedes verla en Eliminados y restaurarla.
					</p>
					<button type="button" className="admin-btn admin-btn--danger" onClick={onDeactivate} disabled={loading}>
						Eliminar
					</button>
				</div>
			) : null}
		</>
	);
}
