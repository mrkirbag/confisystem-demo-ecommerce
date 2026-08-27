import { useEffect, useMemo, useState } from 'react';
import {
	formatFechaUsuario,
	initialsFromName,
	type UsuarioAdmin,
} from '@/lib/usuarios/shared';
import ConfirmDialog from '../crud/ConfirmDialog';
import FormModal from '../crud/FormModal';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '../crud/icons';
import UsuarioForm from './UsuarioForm';

type Props = {
	initialUsers: UsuarioAdmin[];
	currentUserId: string;
};

type Modal =
	| { kind: 'create' }
	| { kind: 'edit'; user: UsuarioAdmin };

type PendingDelete = {
	id: string;
	nombre: string;
};

export default function UsuariosCrud({ initialUsers, currentUserId }: Props) {
	const [users, setUsers] = useState(initialUsers);
	const [modal, setModal] = useState<Modal | null>(null);
	const [query, setQuery] = useState('');
	const [flash, setFlash] = useState('');
	const [listError, setListError] = useState('');
	const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
	const [deleting, setDeleting] = useState(false);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return users;
		return users.filter((user) => {
			const haystack = `${user.nombre} ${user.correo}`.toLowerCase();
			return haystack.includes(needle);
		});
	}, [users, query]);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(''), 4000);
		return () => window.clearTimeout(timer);
	}, [flash]);

	function showFlash(message: string) {
		setListError('');
		setFlash(message);
	}

	function handleCreated(item: UsuarioAdmin) {
		setUsers((current) => [item, ...current.filter((user) => user.id !== item.id)]);
		setModal(null);
		showFlash('Usuario creado.');
	}

	function handleUpdated(item: UsuarioAdmin) {
		setUsers((current) => current.map((user) => (user.id === item.id ? item : user)));
		setModal(null);
		showFlash('Cambios guardados.');
	}

	function handleDeleted(id: string) {
		setUsers((current) => current.filter((user) => user.id !== id));
		setPendingDelete(null);
		setDeleting(false);
		if (modal?.kind === 'edit' && modal.user.id === id) setModal(null);
		showFlash('Usuario eliminado.');
	}

	function requestDelete(user: Pick<UsuarioAdmin, 'id' | 'nombre'>) {
		if (user.id === currentUserId) return;
		setModal(null);
		setPendingDelete({ id: user.id, nombre: user.nombre });
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		setDeleting(true);
		setListError('');

		try {
			const response = await fetch(`/api/admin/usuarios/${pendingDelete.id}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) {
				setListError(payload.error || 'No se pudo eliminar.');
				setDeleting(false);
				setPendingDelete(null);
				return;
			}
			handleDeleted(pendingDelete.id);
		} catch {
			setListError('No se pudo eliminar. Revisa la conexión.');
			setDeleting(false);
			setPendingDelete(null);
		}
	}

	return (
		<section>
			<header className="admin-section-header">
				<p className="admin-section-header__kicker">Configuración</p>
				<h1 className="admin-section-header__title">Usuarios</h1>
			</header>

			{flash ? <div className="admin-flash">{flash}</div> : null}
			{listError ? (
				<div className="admin-form__alert is-visible" role="alert">
					{listError}
				</div>
			) : null}

			<div className="admin-toolbar">
				<p className="admin-toolbar__meta">
					{users.length === 1 ? '1 usuario' : `${users.length} usuarios`}
				</p>
				<label className="admin-toolbar__search">
					<IconSearch className="admin-toolbar__search-icon" />
					<span className="visually-hidden">Buscar usuario</span>
					<input
						className="admin-form__input"
						type="search"
						placeholder="Buscar por nombre o correo"
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
					Nuevo usuario
				</button>
			</div>

			{users.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Aún no hay usuarios</p>
					<p className="admin-empty__text">Crea el primer acceso para el panel de administración.</p>
					<button
						type="button"
						className="admin-btn admin-btn--primary"
						onClick={() => setModal({ kind: 'create' })}
					>
						<IconPlus />
						Nuevo usuario
					</button>
				</div>
			) : filtered.length === 0 ? (
				<div className="admin-empty">
					<p className="admin-empty__title">Sin coincidencias</p>
					<p className="admin-empty__text">Ningún usuario coincide con esa búsqueda.</p>
				</div>
			) : (
				<div className="admin-table-wrap">
					<table className="admin-table admin-table--simple">
						<thead>
							<tr>
								<th>Usuario</th>
								<th>Alta</th>
								<th className="admin-table__th-actions">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((user) => {
								const rowIsSelf = user.id === currentUserId;
								return (
									<tr key={user.id}>
										<td className="admin-table__cell-main">
											<div className="admin-table__store">
												<span className="admin-table__logo-fallback">
													{initialsFromName(user.nombre)}
												</span>
												<span className="admin-table__identity">
													<span className="admin-table__name">
														{user.nombre}
														{rowIsSelf ? <span className="admin-chip">Tú</span> : null}
													</span>
													<span className="admin-table__meta">{user.correo}</span>
												</span>
											</div>
										</td>
										<td data-label="Alta">{formatFechaUsuario(user.creado_en)}</td>
										<td className="admin-table__td-actions" data-label="Acciones">
											<div className="admin-table__actions">
												<button
													type="button"
													className="admin-btn admin-btn--ghost admin-btn--icon-label"
													onClick={() => setModal({ kind: 'edit', user })}
												>
													<IconPencil />
													Editar
												</button>
												{rowIsSelf ? null : (
													<button
														type="button"
														className="admin-btn admin-btn--danger admin-btn--icon-label"
														onClick={() => requestDelete(user)}
													>
														<IconTrash />
														Eliminar
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
				title={modal?.kind === 'edit' ? 'Editar usuario' : 'Nuevo usuario'}
				size="form"
				onClose={() => setModal(null)}
			>
				{modal?.kind === 'create' ? (
					<UsuarioForm
						key="create"
						mode="create"
						onCancel={() => setModal(null)}
						onSaved={handleCreated}
					/>
				) : null}
				{modal?.kind === 'edit' ? (
					<UsuarioForm
						key={modal.user.id}
						mode="edit"
						userId={modal.user.id}
						values={{
							nombre: modal.user.nombre,
							correo: modal.user.correo,
						}}
						canDelete={modal.user.id !== currentUserId}
						onCancel={() => setModal(null)}
						onSaved={handleUpdated}
						onDelete={() => requestDelete(modal.user)}
					/>
				) : null}
			</FormModal>

			<ConfirmDialog
				open={Boolean(pendingDelete)}
				title="Eliminar usuario"
				text={
					pendingDelete
						? `¿Eliminar a ${pendingDelete.nombre}? Se borra de forma permanente y queda en bitácora.`
						: ''
				}
				busy={deleting}
				onCancel={() => {
					if (!deleting) setPendingDelete(null);
				}}
				onConfirm={confirmDelete}
			/>
		</section>
	);
}
