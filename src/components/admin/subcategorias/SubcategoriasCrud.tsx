import { useEffect, useMemo, useState } from 'react';
import type { Categoria } from '@/lib/categorias/shared';
import { initialsFromName, type Subcategoria } from '@/lib/subcategorias/shared';
import ConfirmDialog from '../crud/ConfirmDialog';
import FormModal from '../crud/FormModal';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '../crud/icons';
import SubcategoriaForm from './SubcategoriaForm';

type Props = {
	initialItems: Subcategoria[];
	categorias: Categoria[];
};

type Vista = 'activos' | 'eliminados';

type Modal =
	| { kind: 'create' }
	| { kind: 'edit'; item: Subcategoria };

type PendingOff = {
	id: string;
	nombre: string;
	productos: number;
};

export default function SubcategoriasCrud({ initialItems, categorias }: Props) {
	const [items, setItems] = useState(initialItems);
	const [modal, setModal] = useState<Modal | null>(null);
	const [query, setQuery] = useState('');
	const [vista, setVista] = useState<Vista>('activos');
	const [categoriaId, setCategoriaId] = useState('');
	const [flash, setFlash] = useState('');
	const [listError, setListError] = useState('');
	const [pendingOff, setPendingOff] = useState<PendingOff | null>(null);
	const [busy, setBusy] = useState(false);

	const verEliminados = vista === 'eliminados';
	const hasActiveCategoria = categorias.some((item) => item.activo);

	const categoriaOptions = useMemo(
		() =>
			categorias
				.filter((item) => item.activo)
				.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
		[categorias],
	);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const fromUrl = params.get('categoria') ?? '';
		if (fromUrl) setCategoriaId(fromUrl);
	}, []);

	const pool = useMemo(
		() => items.filter((item) => (verEliminados ? !item.activo : item.activo)),
		[items, verEliminados],
	);

	const hasFilters = Boolean(categoriaId) || Boolean(query.trim());

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return pool.filter((item) => {
			if (categoriaId && item.categoria_id !== categoriaId) return false;
			if (!needle) return true;
			const haystack = `${item.nombre} ${item.slug} ${item.categoria_nombre}`.toLowerCase();
			return haystack.includes(needle);
		});
	}, [pool, query, categoriaId]);

	useEffect(() => {
		if (categoriaId && !categorias.some((item) => item.id === categoriaId)) {
			setCategoriaId('');
		}
	}, [categoriaId, categorias]);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(''), 4000);
		return () => window.clearTimeout(timer);
	}, [flash]);

	function showFlash(message: string) {
		setListError('');
		setFlash(message);
	}

	function upsert(item: Subcategoria) {
		setItems((current) => {
			const exists = current.some((row) => row.id === item.id);
			const next = exists
				? current.map((row) => (row.id === item.id ? item : row))
				: [item, ...current];
			return [...next].sort((a, b) => {
				const cat = a.categoria_nombre.localeCompare(b.categoria_nombre, 'es');
				return cat !== 0 ? cat : a.nombre.localeCompare(b.nombre, 'es');
			});
		});
	}

	function handleCreated(item: Subcategoria) {
		upsert(item);
		setModal(null);
		showFlash('Subcategoría creada.');
	}

	function handleUpdated(item: Subcategoria) {
		upsert(item);
		setModal(null);
		showFlash('Cambios guardados.');
	}

	function openCreate() {
		if (!hasActiveCategoria) {
			setListError('Crea una categoría activa antes de agregar subcategorías.');
			return;
		}
		setModal({ kind: 'create' });
	}

	function requestDeactivate(item: Pick<Subcategoria, 'id' | 'nombre' | 'productos' | 'activo'>) {
		if (!item.activo) return;
		setModal(null);
		setPendingOff({ id: item.id, nombre: item.nombre, productos: item.productos });
	}

	async function confirmDeactivate() {
		if (!pendingOff) return;
		setBusy(true);
		setListError('');

		try {
			const response = await fetch(`/api/admin/subcategorias/${pendingOff.id}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
				item?: Subcategoria;
			};
			if (!response.ok || !payload.item) {
				setListError(payload.error || 'No se pudo eliminar.');
				setBusy(false);
				setPendingOff(null);
				return;
			}
			upsert(payload.item);
			setPendingOff(null);
			setBusy(false);
			showFlash('Subcategoría eliminada.');
		} catch {
			setListError('No se pudo eliminar. Revisa la conexión.');
			setBusy(false);
			setPendingOff(null);
		}
	}

	async function activate(item: Subcategoria) {
		setListError('');
		try {
			const response = await fetch(`/api/admin/subcategorias/${item.id}`, {
				method: 'PATCH',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ activo: true }),
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
				item?: Subcategoria;
			};
			if (!response.ok || !payload.item) {
				setListError(payload.error || 'No se pudo restaurar.');
				return;
			}
			upsert(payload.item);
			showFlash('Subcategoría restaurada.');
		} catch {
			setListError('No se pudo restaurar. Revisa la conexión.');
		}
	}

	return (
		<section>
			<header className="admin-section-header">
				<p className="admin-section-header__kicker">Catálogo</p>
				<h1 className="admin-section-header__title">Subcategorías</h1>
			</header>

			{flash ? <div className="admin-flash">{flash}</div> : null}
			{listError ? (
				<div className="admin-form__alert is-visible" role="alert">
					{listError}
				</div>
			) : null}

			<div className="admin-toolbar">
				<div className="admin-toolbar__bar">
					<p className="admin-toolbar__count">
						<strong>{hasFilters ? filtered.length : pool.length}</strong>
						<span>
							{hasFilters
								? `de ${pool.length} ${verEliminados ? (pool.length === 1 ? 'eliminada' : 'eliminadas') : pool.length === 1 ? 'subcategoría' : 'subcategorías'}`
								: verEliminados
									? pool.length === 1
										? 'eliminada'
										: 'eliminadas'
									: pool.length === 1
										? 'subcategoría'
										: 'subcategorías'}
						</span>
					</p>
					<button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
						<IconPlus />
						Nueva subcategoría
					</button>
				</div>
				<div className="admin-toolbar__filters">
					<div className="admin-toolbar__seg" role="group" aria-label="Estado">
						<button
							type="button"
							className={vista === 'activos' ? 'is-on' : undefined}
							aria-pressed={vista === 'activos'}
							onClick={() => setVista('activos')}
						>
							Activos
						</button>
						<button
							type="button"
							className={vista === 'eliminados' ? 'is-on' : undefined}
							aria-pressed={vista === 'eliminados'}
							onClick={() => setVista('eliminados')}
						>
							Eliminados
						</button>
					</div>
					<label className={`admin-toolbar__select${categoriaId ? ' is-on' : ''}`}>
						<span className="visually-hidden">Filtrar por categoría</span>
						<select
							className="admin-toolbar__control"
							value={categoriaId}
							onChange={(event) => setCategoriaId(event.target.value)}
						>
							<option value="">Todas las categorías</option>
							{categoriaOptions.map((item) => (
								<option key={item.id} value={item.id}>
									{item.nombre}
								</option>
							))}
						</select>
					</label>
					<label className="admin-toolbar__search">
						<IconSearch className="admin-toolbar__search-icon" />
						<span className="visually-hidden">Buscar subcategoría</span>
						<input
							className="admin-toolbar__control"
							type="search"
							placeholder="Buscar…"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>
				</div>
			</div>

			{items.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Aún no hay subcategorías</p>
					<p className="admin-empty__text">
						{hasActiveCategoria
							? 'Ejemplo: en Redes crea Módems, Routers, Decos o Extensores. Los productos se asignan a la subcategoría.'
							: 'Primero crea una categoría activa.'}
					</p>
					{hasActiveCategoria ? (
						<button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
							<IconPlus />
							Nueva subcategoría
						</button>
					) : (
						<a className="admin-btn admin-btn--primary" href="/admin/catalogo/categorias">
							Ir a categorías
						</a>
					)}
				</div>
			) : pool.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">
						{verEliminados ? 'No hay eliminadas' : 'No hay subcategorías'}
					</p>
					<p className="admin-empty__text">
						{verEliminados
							? 'Las subcategorías que elimines aparecerán aquí para restaurarlas.'
							: 'Todas están en Eliminados. Restaura una para volver a usarla.'}
					</p>
				</div>
			) : filtered.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Sin coincidencias</p>
					<p className="admin-empty__text">
						{categoriaId && query.trim()
							? 'Ninguna subcategoría coincide con esa categoría y búsqueda.'
							: categoriaId
								? 'Ninguna subcategoría en esta categoría.'
								: 'Ninguna subcategoría coincide con esa búsqueda.'}
					</p>
				</div>
			) : (
				<div className="admin-table-wrap">
					<table className="admin-table admin-table--simple">
						<thead>
							<tr>
								<th>Subcategoría</th>
								<th>Categoría</th>
								<th className="admin-table__th-actions">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((item) => (
								<tr key={item.id}>
									<td className="admin-table__cell-main">
										<div className="admin-table__store">
											{item.imagen_url ? (
												<img className="admin-table__logo" src={item.imagen_url} alt="" />
											) : (
												<span className="admin-table__logo-fallback">
													{initialsFromName(item.nombre)}
												</span>
											)}
											<span className="admin-table__identity">
												<span className="admin-table__name">{item.nombre}</span>
												<span className="admin-table__meta">{item.slug}</span>
											</span>
										</div>
									</td>
									<td data-label="Categoría">{item.categoria_nombre}</td>
									<td className="admin-table__td-actions" data-label="Acciones">
										<div className="admin-table__actions">
											<button
												type="button"
												className="admin-btn admin-btn--ghost admin-btn--icon-label"
												onClick={() => setModal({ kind: 'edit', item })}
											>
												<IconPencil />
												Editar
											</button>
											{item.activo ? (
												<button
													type="button"
													className="admin-btn admin-btn--danger admin-btn--icon-label"
													onClick={() => requestDeactivate(item)}
												>
													<IconTrash />
													Eliminar
												</button>
											) : (
												<button
													type="button"
													className="admin-btn admin-btn--ghost admin-btn--icon-label"
													onClick={() => activate(item)}
												>
													Restaurar
												</button>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<FormModal
				open={Boolean(modal)}
				title={modal?.kind === 'edit' ? 'Editar subcategoría' : 'Nueva subcategoría'}
				size="form"
				onClose={() => setModal(null)}
			>
				{modal?.kind === 'create' ? (
					<SubcategoriaForm
						key="create"
						mode="create"
						categorias={categorias}
						values={categoriaId ? { categoria_id: categoriaId, nombre: '', slug: '', imagen_url: null } : undefined}
						onCancel={() => setModal(null)}
						onSaved={handleCreated}
					/>
				) : null}
				{modal?.kind === 'edit' ? (
					<SubcategoriaForm
						key={modal.item.id}
						mode="edit"
						subcategoriaId={modal.item.id}
						categorias={categorias}
						values={{
							categoria_id: modal.item.categoria_id,
							nombre: modal.item.nombre,
							slug: modal.item.slug,
							imagen_url: modal.item.imagen_url,
						}}
						canDeactivate={modal.item.activo}
						onCancel={() => setModal(null)}
						onSaved={handleUpdated}
						onDeactivate={() => requestDeactivate(modal.item)}
					/>
				) : null}
			</FormModal>

			<ConfirmDialog
				open={Boolean(pendingOff)}
				title="Eliminar subcategoría"
				text={
					pendingOff
						? pendingOff.productos > 0
							? `¿Eliminar ${pendingOff.nombre}? Tiene ${pendingOff.productos} ${pendingOff.productos === 1 ? 'producto' : 'productos'}. Saldrá del listado y de la tienda. Puedes restaurarla en Eliminados.`
							: `¿Eliminar ${pendingOff.nombre}? Saldrá del listado y de la tienda. Puedes restaurarla en Eliminados.`
						: ''
				}
				confirmLabel="Eliminar"
				busyLabel="Eliminando…"
				busy={busy}
				onCancel={() => {
					if (!busy) setPendingOff(null);
				}}
				onConfirm={confirmDeactivate}
			/>
		</section>
	);
}
