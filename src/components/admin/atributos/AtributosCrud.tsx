import { useEffect, useMemo, useState } from 'react';
import { resumenAtributo, type Atributo } from '@/lib/atributos/shared';
import ConfirmDialog from '../crud/ConfirmDialog';
import FormModal from '../crud/FormModal';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '../crud/icons';
import AtributoForm from './AtributoForm';

type Props = {
	initialItems: Atributo[];
};

type Modal =
	| { kind: 'create' }
	| { kind: 'edit'; item: Atributo };

type PendingDelete = {
	id: string;
	nombre: string;
	usos: number;
};

export default function AtributosCrud({ initialItems }: Props) {
	const [items, setItems] = useState(initialItems);
	const [modal, setModal] = useState<Modal | null>(null);
	const [query, setQuery] = useState('');
	const [flash, setFlash] = useState('');
	const [listError, setListError] = useState('');
	const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
	const [busy, setBusy] = useState(false);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return items;
		return items.filter((item) => {
			const opciones = item.opciones.map((opcion) => opcion.valor).join(' ');
			return `${item.nombre} ${opciones}`.toLowerCase().includes(needle);
		});
	}, [items, query]);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(''), 4000);
		return () => window.clearTimeout(timer);
	}, [flash]);

	function showFlash(message: string) {
		setListError('');
		setFlash(message);
	}

	function upsert(item: Atributo) {
		setItems((current) => {
			const exists = current.some((row) => row.id === item.id);
			const next = exists
				? current.map((row) => (row.id === item.id ? item : row))
				: [item, ...current];
			return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
		});
	}

	function handleCreated(item: Atributo) {
		upsert(item);
		setModal(null);
		showFlash('Atributo creado.');
	}

	function handleUpdated(item: Atributo) {
		upsert(item);
		setModal(null);
		showFlash('Cambios guardados.');
	}

	function requestDelete(item: Pick<Atributo, 'id' | 'nombre' | 'usos'>) {
		setModal(null);
		if (item.usos > 0) {
			setListError(
				`No se puede eliminar ${item.nombre}: lo usan ${item.usos} ${item.usos === 1 ? 'producto' : 'productos'}.`,
			);
			return;
		}
		setPendingDelete({ id: item.id, nombre: item.nombre, usos: item.usos });
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		setBusy(true);
		setListError('');

		try {
			const response = await fetch(`/api/admin/atributos/${pendingDelete.id}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) {
				setListError(payload.error || 'No se pudo eliminar.');
				setBusy(false);
				setPendingDelete(null);
				return;
			}
			setItems((current) => current.filter((item) => item.id !== pendingDelete.id));
			setPendingDelete(null);
			setBusy(false);
			showFlash('Atributo eliminado.');
		} catch {
			setListError('No se pudo eliminar. Revisa la conexión.');
			setBusy(false);
			setPendingDelete(null);
		}
	}

	return (
		<section>
			<header className="admin-section-header">
				<p className="admin-section-header__kicker">Catálogo</p>
				<h1 className="admin-section-header__title">Atributos</h1>
			</header>

			{flash ? <div className="admin-flash">{flash}</div> : null}
			{listError ? (
				<div className="admin-form__alert is-visible" role="alert">
					{listError}
				</div>
			) : null}

			<div className="admin-toolbar">
				<p className="admin-toolbar__meta">
					{items.length === 1 ? '1 atributo' : `${items.length} atributos`}
				</p>
				<label className="admin-toolbar__search">
					<IconSearch className="admin-toolbar__search-icon" />
					<span className="visually-hidden">Buscar atributo</span>
					<input
						className="admin-form__input"
						type="search"
						placeholder="Buscar por nombre u opción"
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
					Nuevo atributo
				</button>
			</div>

			{items.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Aún no hay atributos</p>
					<p className="admin-empty__text">
						Crea talla, color u otros datos que luego usarás en los productos.
					</p>
					<button
						type="button"
						className="admin-btn admin-btn--primary"
						onClick={() => setModal({ kind: 'create' })}
					>
						<IconPlus />
						Nuevo atributo
					</button>
				</div>
			) : filtered.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Sin coincidencias</p>
					<p className="admin-empty__text">Ningún atributo coincide con esa búsqueda.</p>
				</div>
			) : (
				<div className="admin-table-wrap">
					<table className="admin-table admin-table--simple">
						<thead>
							<tr>
								<th>Atributo</th>
								<th className="admin-table__th-actions">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((item) => (
								<tr key={item.id}>
									<td className="admin-table__cell-main">
										<div className="admin-table__identity">
											<span className="admin-table__name">{item.nombre}</span>
											<span className="admin-table__meta">{resumenAtributo(item)}</span>
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
											<button
												type="button"
												className="admin-btn admin-btn--danger admin-btn--icon-label"
												onClick={() => requestDelete(item)}
											>
												<IconTrash />
												Eliminar
											</button>
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
				title={modal?.kind === 'edit' ? 'Editar atributo' : 'Nuevo atributo'}
				size="sheet"
				onClose={() => setModal(null)}
			>
				{modal?.kind === 'create' ? (
					<AtributoForm
						key="create"
						mode="create"
						onCancel={() => setModal(null)}
						onSaved={handleCreated}
					/>
				) : null}
				{modal?.kind === 'edit' ? (
					<AtributoForm
						key={modal.item.id}
						mode="edit"
						atributoId={modal.item.id}
						values={{
							nombre: modal.item.nombre,
							tipo: modal.item.tipo,
							opciones: modal.item.opciones,
						}}
						canDelete
						onCancel={() => setModal(null)}
						onSaved={handleUpdated}
						onDelete={() => requestDelete(modal.item)}
					/>
				) : null}
			</FormModal>

			<ConfirmDialog
				open={Boolean(pendingDelete)}
				title="Eliminar atributo"
				text={
					pendingDelete
						? `¿Eliminar ${pendingDelete.nombre}? Se borran también sus opciones.`
						: ''
				}
				confirmLabel="Eliminar"
				busy={busy}
				onCancel={() => {
					if (!busy) setPendingDelete(null);
				}}
				onConfirm={confirmDelete}
			/>
		</section>
	);
}
