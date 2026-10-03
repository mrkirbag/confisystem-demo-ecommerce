import { useEffect, useMemo, useState } from 'react';
import type { Atributo } from '@/lib/atributos/shared';
import type { Categoria } from '@/lib/categorias/shared';
import {
	formatPrecio,
	formatPrecioRango,
	formatSkus,
	formatStock,
	initialsFromName,
	type ProductoListado,
} from '@/lib/productos/shared';
import type { Subcategoria } from '@/lib/subcategorias/shared';
import ConfirmDialog from '../crud/ConfirmDialog';
import FormModal from '../crud/FormModal';
import { IconEye, IconPencil, IconPlus, IconSearch, IconTrash } from '../crud/icons';
import ProductoForm from './ProductoForm';
import ProductoPreview from './ProductoPreview';

type Props = {
	initialItems: ProductoListado[];
	categorias: Categoria[];
	subcategorias: Subcategoria[];
	atributos: Atributo[];
	storeName: string;
};

type Vista = 'activos' | 'eliminados';

type Modal =
	| { kind: 'create' }
	| { kind: 'edit'; item: ProductoListado }
	| { kind: 'preview'; item: ProductoListado };

export default function ProductosCrud({ initialItems, categorias, subcategorias, atributos, storeName }: Props) {
	const [items, setItems] = useState(initialItems);
	const [modal, setModal] = useState<Modal | null>(null);
	const [query, setQuery] = useState('');
	const [vista, setVista] = useState<Vista>('activos');
	const [categoriaId, setCategoriaId] = useState('');
	const [subcategoriaId, setSubcategoriaId] = useState('');
	const [flash, setFlash] = useState('');
	const [listError, setListError] = useState('');
	const [pendingOff, setPendingOff] = useState<ProductoListado | null>(null);
	const [busy, setBusy] = useState(false);

	const verEliminados = vista === 'eliminados';
	const hasActiveSubcategoria = subcategorias.some((item) => item.activo);

	const pool = useMemo(
		() => items.filter((item) => (verEliminados ? !item.activo : item.activo)),
		[items, verEliminados],
	);

	const hasFilters = Boolean(categoriaId) || Boolean(subcategoriaId) || Boolean(query.trim());

	const categoriaOptions = useMemo(
		() =>
			categorias
				.filter((item) => item.activo)
				.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
		[categorias],
	);

	const subcategoriaOptions = useMemo(
		() =>
			subcategorias
				.filter((item) => item.activo && (!categoriaId || item.categoria_id === categoriaId))
				.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
		[subcategorias, categoriaId],
	);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return pool.filter((item) => {
			if (categoriaId && item.categoria_id !== categoriaId) return false;
			if (subcategoriaId && item.subcategoria_id !== subcategoriaId) return false;
			if (!needle) return true;
			const haystack = `${item.nombre} ${item.slug} ${(item.skus ?? []).join(' ')}`.toLowerCase();
			return haystack.includes(needle);
		});
	}, [pool, query, categoriaId, subcategoriaId]);

	useEffect(() => {
		if (categoriaId && !categoriaOptions.some((item) => item.id === categoriaId)) {
			setCategoriaId('');
		}
	}, [categoriaId, categoriaOptions]);

	useEffect(() => {
		if (subcategoriaId && !subcategoriaOptions.some((item) => item.id === subcategoriaId)) {
			setSubcategoriaId('');
		}
	}, [subcategoriaId, subcategoriaOptions]);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(''), 4000);
		return () => window.clearTimeout(timer);
	}, [flash]);

	function showFlash(message: string) {
		setListError('');
		setFlash(message);
	}

	function upsert(item: ProductoListado) {
		setItems((current) => {
			const exists = current.some((row) => row.id === item.id);
			const next = exists
				? current.map((row) => (row.id === item.id ? item : row))
				: [item, ...current];
			return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
		});
	}

	function handleCreated(item: ProductoListado) {
		upsert(item);
		setModal(null);
		showFlash('Producto creado.');
	}

	function handleUpdated(item: ProductoListado) {
		upsert(item);
		setModal(null);
		showFlash('Cambios guardados.');
	}

	function openCreate() {
		if (!hasActiveSubcategoria) {
			setListError('Crea una subcategoría activa antes de agregar productos.');
			return;
		}
		setModal({ kind: 'create' });
	}

	function requestDeactivate(item: ProductoListado) {
		if (!item.activo) return;
		setModal(null);
		setPendingOff(item);
	}

	async function confirmDeactivate() {
		if (!pendingOff) return;
		setBusy(true);
		setListError('');

		try {
			const response = await fetch(`/api/admin/productos/${pendingOff.id}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
				item?: ProductoListado;
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
			showFlash('Producto eliminado.');
		} catch {
			setListError('No se pudo eliminar. Revisa la conexión.');
			setBusy(false);
			setPendingOff(null);
		}
	}

	async function activate(item: ProductoListado) {
		setListError('');
		try {
			const response = await fetch(`/api/admin/productos/${item.id}`, {
				method: 'PATCH',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ activo: true }),
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
				item?: ProductoListado;
			};
			if (!response.ok || !payload.item) {
				setListError(payload.error || 'No se pudo restaurar.');
				return;
			}
			upsert(payload.item);
			showFlash('Producto restaurado.');
		} catch {
			setListError('No se pudo restaurar. Revisa la conexión.');
		}
	}

	return (
		<section>
			<header className="admin-section-header">
				<p className="admin-section-header__kicker">Catálogo</p>
				<h1 className="admin-section-header__title">Productos</h1>
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
								? `de ${pool.length} ${verEliminados ? (pool.length === 1 ? 'eliminado' : 'eliminados') : pool.length === 1 ? 'producto' : 'productos'}`
								: verEliminados
									? pool.length === 1
										? 'eliminado'
										: 'eliminados'
									: pool.length === 1
										? 'producto'
										: 'productos'}
						</span>
					</p>
					<button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
						<IconPlus />
						Nuevo producto
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
					<label className={`admin-toolbar__select${subcategoriaId ? ' is-on' : ''}`}>
						<span className="visually-hidden">Filtrar por subcategoría</span>
						<select
							className="admin-toolbar__control"
							value={subcategoriaId}
							onChange={(event) => setSubcategoriaId(event.target.value)}
						>
							<option value="">Todas las subcategorías</option>
							{subcategoriaOptions.map((item) => (
								<option key={item.id} value={item.id}>
									{categoriaId ? item.nombre : `${item.categoria_nombre} · ${item.nombre}`}
								</option>
							))}
						</select>
					</label>
					<label className="admin-toolbar__search">
						<IconSearch className="admin-toolbar__search-icon" />
						<span className="visually-hidden">Buscar producto</span>
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
					<p className="admin-empty__title">Aún no hay productos</p>
					<p className="admin-empty__text">
						{hasActiveSubcategoria
							? 'Crea el primero para mostrar el catálogo.'
							: 'Primero crea una subcategoría activa (por ejemplo Redes → Routers).'}
					</p>
					{hasActiveSubcategoria ? (
						<button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
							<IconPlus />
							Nuevo producto
						</button>
					) : (
						<a className="admin-btn admin-btn--primary" href="/admin/catalogo/subcategorias">
							Ir a subcategorías
						</a>
					)}
				</div>
			) : pool.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">
						{verEliminados ? 'No hay eliminados' : 'No hay productos'}
					</p>
					<p className="admin-empty__text">
						{verEliminados
							? 'Los productos que elimines aparecerán aquí para restaurarlos.'
							: 'Todos están en Eliminados. Restaura uno para volver a usarlo.'}
					</p>
				</div>
			) : filtered.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Sin coincidencias</p>
					<p className="admin-empty__text">
						{subcategoriaId && query.trim()
							? 'Ningún producto coincide con esa subcategoría y búsqueda.'
							: categoriaId && query.trim()
								? 'Ningún producto coincide con esa categoría y búsqueda.'
								: subcategoriaId
									? 'Ningún producto en esta subcategoría.'
									: categoriaId
										? 'Ningún producto en esta categoría.'
										: 'Ningún producto coincide con esa búsqueda.'}
					</p>
				</div>
			) : (
				<div className="admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Producto</th>
								<th>Categoría</th>
								<th>Subcategoría</th>
								<th>Precio USD</th>
								<th className="admin-table__th-actions">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((item) => {
								const agotado = item.stock_total <= 0;
								const oferta = item.en_oferta && item.precio_oferta > 0;
								return (
								<tr key={item.id}>
									<td className="admin-table__cell-main">
										<div className={`admin-table__store${agotado ? ' is-sold' : ''}`}>
											{item.imagen_url ? (
												<img className="admin-table__logo" src={item.imagen_url} alt="" />
											) : (
												<span className="admin-table__logo-fallback">
													{initialsFromName(item.nombre)}
												</span>
											)}
											<span className="admin-table__identity">
												<span className="admin-table__name">
													{item.nombre}
													{item.es_tendencia ? <span className="admin-chip">Tendencia</span> : null}
													{oferta ? <span className="admin-chip admin-chip--offer">Oferta</span> : null}
													{agotado ? <span className="admin-chip admin-chip--sold">Agotado</span> : null}
												</span>
												<span className="admin-table__meta">
													{formatSkus(item.skus ?? []) || item.slug} ·{' '}
													{agotado ? 'Agotado' : formatStock(item.stock_total)}
												</span>
											</span>
										</div>
									</td>
									<td data-label="Categoría">{item.categoria_nombre}</td>
									<td data-label="Subcategoría">{item.subcategoria_nombre || '—'}</td>
									<td data-label="Precio USD">
										{oferta ? (
											<span className="admin-price admin-price--offer">
												<s>{formatPrecioRango(item.precio_min, item.precio_max)}</s>
												<strong>{formatPrecio(item.precio_oferta)}</strong>
											</span>
										) : (
											formatPrecioRango(item.precio_min, item.precio_max)
										)}
									</td>
									<td className="admin-table__td-actions" data-label="Acciones">
										<div className="admin-table__actions">
											<button
												type="button"
												className="admin-btn admin-btn--success admin-btn--icon-label"
												onClick={() => setModal({ kind: 'preview', item })}
											>
												<IconEye />
												Ver
											</button>
											<button
												type="button"
												className="admin-btn admin-btn--info admin-btn--icon-label"
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
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<FormModal
				open={Boolean(modal)}
				title={
					modal?.kind === 'preview'
						? 'Vista previa'
						: modal?.kind === 'edit'
							? 'Editar producto'
							: 'Nuevo producto'
				}
				kicker={modal?.kind === 'preview' ? 'Así lo verá el cliente' : undefined}
				size={modal?.kind === 'preview' ? 'preview' : 'sheet'}
				onClose={() => setModal(null)}
			>
				{modal?.kind === 'create' ? (
					<ProductoForm
						key="create"
						mode="create"
						categorias={categorias}
						subcategorias={subcategorias}
						atributos={atributos}
						onCancel={() => setModal(null)}
						onSaved={handleCreated}
					/>
				) : null}
				{modal?.kind === 'edit' ? (
					<ProductoForm
						key={modal.item.id}
						mode="edit"
						productoId={modal.item.id}
						categorias={categorias}
						subcategorias={subcategorias}
						atributos={atributos}
						canDeactivate={modal.item.activo}
						onCancel={() => setModal(null)}
						onSaved={handleUpdated}
						onDeactivate={() => requestDeactivate(modal.item)}
					/>
				) : null}
				{modal?.kind === 'preview' ? (
					<ProductoPreview
						key={modal.item.id}
						productoId={modal.item.id}
						atributos={atributos}
						storeName={storeName}
					/>
				) : null}
			</FormModal>

			<ConfirmDialog
				open={Boolean(pendingOff)}
				title="Eliminar producto"
				text={
					pendingOff
						? `¿Eliminar ${pendingOff.nombre}? Saldrá del listado y de la tienda. Puedes restaurarlo en Eliminados.`
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
