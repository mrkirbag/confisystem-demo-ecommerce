import { useEffect, useState, type FormEvent } from 'react';
import type { Categoria } from '@/lib/categorias/shared';
import { isValidSlug, slugify, type Subcategoria } from '@/lib/subcategorias/shared';
import ImageUpload from '../crud/ImageUpload';

type Props = {
	mode: 'create' | 'edit';
	values?: Pick<Subcategoria, 'categoria_id' | 'nombre' | 'slug' | 'imagen_url'>;
	subcategoriaId?: string;
	categorias: Categoria[];
	canDeactivate?: boolean;
	onCancel: () => void;
	onSaved: (item: Subcategoria) => void;
	onDeactivate?: () => void;
};

type ApiResponse = {
	error?: string;
	item?: Subcategoria;
};

export default function SubcategoriaForm({
	mode,
	values,
	subcategoriaId,
	categorias,
	canDeactivate = false,
	onCancel,
	onSaved,
	onDeactivate,
}: Props) {
	const activas = categorias.filter((item) => item.activo);
	const [categoriaId, setCategoriaId] = useState(values?.categoria_id || activas[0]?.id || '');
	const [nombre, setNombre] = useState(values?.nombre ?? '');
	const [slug, setSlug] = useState(values?.slug ?? '');
	const [slugLocked, setSlugLocked] = useState(mode === 'edit');
	const [imagenUrl, setImagenUrl] = useState(values?.imagen_url ?? null);
	const [file, setFile] = useState<File | null>(null);
	const [fileName, setFileName] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submitLabel = mode === 'create' ? 'Crear subcategoría' : 'Guardar cambios';

	const categoriaOptions = (() => {
		const ids = new Set(activas.map((item) => item.id));
		if (categoriaId && !ids.has(categoriaId)) {
			const current = categorias.find((item) => item.id === categoriaId);
			return current ? [current, ...activas] : activas;
		}
		return activas;
	})();

	const categoriaSlug =
		categorias.find((item) => item.id === categoriaId)?.slug ??
		activas.find((item) => item.id === categoriaId)?.slug ??
		'';

	useEffect(() => {
		if (slugLocked) return;
		setSlug(slugify(nombre));
	}, [nombre, slugLocked]);

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError('');

		const nombreTrim = nombre.trim();
		const slugTrim = slugify(slug.trim() || nombreTrim);

		if (!categoriaId) {
			setError('Elige una categoría.');
			return;
		}
		if (nombreTrim.length < 2) {
			setError('El nombre es obligatorio.');
			return;
		}
		if (!isValidSlug(slugTrim)) {
			setError('El slug no es válido. Usa minúsculas, números y guiones.');
			return;
		}
		if (file && !categoriaSlug) {
			setError('No se pudo resolver el slug de la categoría.');
			return;
		}

		setLoading(true);

		try {
			let nextImagen = imagenUrl;

			if (file) {
				const uploadData = new FormData();
				uploadData.append('kind', 'subcategoria');
				uploadData.append('slug', slugTrim);
				uploadData.append('parent_slug', categoriaSlug);
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
				mode === 'create' ? '/api/admin/subcategorias' : `/api/admin/subcategorias/${subcategoriaId}`;
			const response = await fetch(endpoint, {
				method: mode === 'create' ? 'POST' : 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					categoria_id: categoriaId,
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

	if (categoriaOptions.length === 0) {
		return (
			<div className="admin-form admin-form--stack">
				<p className="admin-form__hint admin-form__hint--box">
					Primero crea una categoría activa. La subcategoría se agrupa dentro de ella.
				</p>
				<div className="admin-form__actions">
					<a className="admin-btn admin-btn--primary" href="/admin/catalogo/categorias">
						Ir a categorías
					</a>
					<button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel}>
						Cerrar
					</button>
				</div>
			</div>
		);
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
						Categoría
						<select
							className="admin-form__input admin-form__select"
							required
							value={categoriaId}
							onChange={(event) => setCategoriaId(event.target.value)}
						>
							{categoriaOptions.map((item) => (
								<option key={item.id} value={item.id}>
									{item.activo ? item.nombre : `${item.nombre} (inactiva)`}
								</option>
							))}
						</select>
					</label>

					<label className="admin-form__field admin-form__field--full">
						Nombre
						<input
							className="admin-form__input"
							type="text"
							required
							minLength={2}
							maxLength={80}
							autoFocus
							placeholder="Routers"
							value={nombre}
							onChange={(event) => setNombre(event.target.value)}
						/>
					</label>

					<label className="admin-form__field admin-form__field--full">
						Slug
						<input
							className="admin-form__input"
							type="text"
							required
							maxLength={80}
							placeholder="routers"
							value={slug}
							onChange={(event) => {
								setSlugLocked(true);
								setSlug(slugify(event.target.value));
							}}
						/>
					</label>

					<ImageUpload
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
					<h3 className="admin-danger__title">Eliminar subcategoría</h3>
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
