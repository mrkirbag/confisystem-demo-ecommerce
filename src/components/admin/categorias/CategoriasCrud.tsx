import { useEffect, useMemo, useState } from 'react';
import { initialsFromName, type Categoria } from '@/lib/categorias/shared';
import ConfirmDialog from '../crud/ConfirmDialog';
import FormModal from '../crud/FormModal';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '../crud/icons';
import CategoriaForm from './CategoriaForm';

type Props = {
	initialItems: Categoria[];
};

type Vista = 'activos' | 'eliminados';

type Modal =
	| { kind: 'create' }
	| { kind: 'edit'; item: Categoria };

type PendingOff = {
	id: string;
	nombre: string;
	productos: number;
};

export default function CategoriasCrud({ initialItems }: Props) {
	const [items, setItems] = useState(initialItems);
	const [modal, setModal] = useState<Modal | null>(null);
	const [query, setQuery] = useState('');
	const [vista, setVista] = useState<Vista>('activos');
	const [flash, setFlash] = useState('');
	const [listError, setListError] = useState('');
	const [pendingOff, setPendingOff] = useState<PendingOff | null>(null);
	const [busy, setBusy] = useState(false);

	const verEliminados = vista === 'eliminados';
	const pool = useMemo(
		() => items.filter((item) => (verEliminados ? !item.activo : item.activo)),
		[items, verEliminados],
	);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return pool;
		return pool.filter((item) => {
			const haystack = `${item.nombre} ${item.slug}`.toLowerCase();
			return haystack.includes(needle);
		});
	}, [pool, query]);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(''), 4000);
		return () => window.clearTimeout(timer);
	}, [flash]);

	function showFlash(message: string) {
		setListError('');
		setFlash(message);
	}

	function upsert(item: Categoria) {
		setItems((current) => {
			const exists = current.some((row) => row.id === item.id);
			const next = exists
				? current.map((row) => (row.id === item.id ? item : row))
				: [item, ...current];
			return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
		});
	}

	function handleCreated(item: Categoria) {
		upsert(item);
		setModal(null);
		showFlash('Categoría creada.');
	}

	function handleUpdated(item: Categoria) {
		upsert(item);
		setModal(null);
		showFlash('Cambios guardados.');
	}

	function requestDeactivate(item: Pick<Categoria, 'id' | 'nombre' | 'productos' | 'activo'>) {
		if (!item.activo) return;
		setModal(null);
		setPendingOff({ id: item.id, nombre: item.nombre, productos: item.productos });
	}

	async function confirmDeactivate() {
		if (!pendingOff) return;
		setBusy(true);
		setListError('');

		try {
			const response = await fetch(`/api/admin/categorias/${pendingOff.id}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
				item?: Categoria;
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
			showFlash('Categoría eliminada.');
		} catch {
			setListError('No se pudo eliminar. Revisa la conexión.');
			setBusy(false);
			setPendingOff(null);
		}
	}

	async function activate(item: Categoria) {
		setListError('');
		try {
			const response = await fetch(`/api/admin/categorias/${item.id}`, {
				method: 'PATCH',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ activo: true }),
			});
			const payload = (await response.json().catch(() => ({}))) as {
				error?: string;
				item?: Categoria;
			};
			if (!response.ok || !payload.item) {
				setListError(payload.error || 'No se pudo restaurar.');
				return;
			}
			upsert(payload.item);
			showFlash('Categoría restaurada.');
		} catch {
			setListError('No se pudo restaurar. Revisa la conexión.');
		}
	}

	return (
		<section>
			<header className="admin-section-header">
				<p className="admin-section-header__kicker">Catálogo</p>
				<h1 className="admin-section-header__title">Categorías</h1>
			</header>

			{flash ? <div className="admin-flash">{flash}</div> : null}
			{listError ? (
				<div className="admin-form__alert is-visible" role="alert">
					{listError}
				</div>
			) : null}

			<div className="admin-toolbar">
				<p className="admin-toolbar__meta">
					{query.trim()
						? `${filtered.length} de ${pool.length} ${verEliminados ? 'eliminadas' : pool.length === 1 ? 'categoría' : 'categorías'}`
						: verEliminados
							? pool.length === 1
								? '1 eliminada'
								: `${pool.length} eliminadas`
							: pool.length === 1
								? '1 categoría'
								: `${pool.length} categorías`}
				</p>
				<label className="admin-toolbar__filter admin-toolbar__filter--status">
					<span className="visually-hidden">Ver</span>
					<select
						className="admin-form__input admin-form__select"
						value={vista}
						onChange={(event) => setVista(event.target.value as Vista)}
					>
						<option value="activos">Activos</option>
						<option value="eliminados">Eliminados</option>
					</select>
				</label>
				<label className="admin-toolbar__search">
					<IconSearch className="admin-toolbar__search-icon" />
					<span className="visually-hidden">Buscar categoría</span>
					<input
						className="admin-form__input"
						type="search"
						placeholder="Buscar por nombre o slug"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</label>
				<button
					type="button"
					className="admin-btn admin-btn--primary"
					onClick={() => setModal({ kind: 'create' })}
				>
					<IconPlus />
					Nueva categoría
				</button>
			</div>

			{items.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Aún no hay categorías</p>
					<p className="admin-empty__text">Crea la primera para organizar el catálogo.</p>
					<button
						type="button"
						className="admin-btn admin-btn--primary"
						onClick={() => setModal({ kind: 'create' })}
					>
						<IconPlus />
						Nueva categoría
					</button>
				</div>
			) : pool.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">
						{verEliminados ? 'No hay eliminadas' : 'No hay categorías'}
					</p>
					<p className="admin-empty__text">
						{verEliminados
							? 'Las categorías que elimines aparecerán aquí para restaurarlas.'
							: 'Todas están en Eliminados. Restaura una para volver a usarla.'}
					</p>
				</div>
			) : filtered.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Sin coincidencias</p>
					<p className="admin-empty__text">Ninguna categoría coincide con esa búsqueda.</p>
				</div>
			) : (
				<div className="admin-table-wrap">
					<table className="admin-table admin-table--simple">
						<thead>
							<tr>
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
				title={modal?.kind === 'edit' ? 'Editar categoría' : 'Nueva categoría'}
				size="form"
				onClose={() => setModal(null)}
			>
				{modal?.kind === 'create' ? (
					<CategoriaForm
						key="create"
						mode="create"
						onCancel={() => setModal(null)}
						onSaved={handleCreated}
					/>
				) : null}
				{modal?.kind === 'edit' ? (
					<CategoriaForm
						key={modal.item.id}
						mode="edit"
						categoriaId={modal.item.id}
						values={{
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
				title="Eliminar categoría"
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
