import { useState, type FormEvent } from 'react';
import type { UsuarioAdmin } from '@/lib/usuarios/shared';
import { IconChevron, IconEye, IconEyeOff } from '../crud/icons';

type Props = {
	mode: 'create' | 'edit';
	values?: Pick<UsuarioAdmin, 'nombre' | 'correo'>;
	userId?: string;
	canDelete?: boolean;
	onCancel: () => void;
	onSaved: (item: UsuarioAdmin) => void;
	onDelete?: () => void;
};

type ApiResponse = {
	error?: string;
	item?: UsuarioAdmin;
};

function PasswordField({
	label,
	value,
	onChange,
	placeholder,
	required,
	autoFocus,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	required?: boolean;
	autoFocus?: boolean;
}) {
	const [visible, setVisible] = useState(false);

	return (
		<label className="admin-form__field admin-form__field--full">
			{label}
			<span className="admin-form__secret">
				<input
					className="admin-form__input"
					type={visible ? 'text' : 'password'}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					minLength={8}
					autoComplete="new-password"
					placeholder={placeholder}
					required={required}
					autoFocus={autoFocus}
				/>
				<button
					type="button"
					className={`admin-form__secret-toggle${visible ? ' is-on' : ''}`}
					aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
					onClick={() => setVisible((current) => !current)}
				>
					{visible ? <IconEyeOff /> : <IconEye />}
				</button>
			</span>
		</label>
	);
}

export default function UsuarioForm({
	mode,
	values,
	userId,
	canDelete = false,
	onCancel,
	onSaved,
	onDelete,
}: Props) {
	const [nombre, setNombre] = useState(values?.nombre ?? '');
	const [correo, setCorreo] = useState(values?.correo ?? '');
	const [password, setPassword] = useState('');
	const [passwordConfirm, setPasswordConfirm] = useState('');
	const [changePassword, setChangePassword] = useState(mode === 'create');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submitLabel = mode === 'create' ? 'Crear usuario' : 'Guardar cambios';

	function togglePassword() {
		setChangePassword((open) => {
			if (open) {
				setPassword('');
				setPasswordConfirm('');
			}
			return !open;
		});
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError('');

		const nombreTrim = nombre.trim();
		const correoTrim = correo.trim();
		const wantsPassword = mode === 'create' || changePassword;

		if (nombreTrim.length < 2) {
			setError('El nombre es obligatorio.');
			return;
		}
		if (!correoTrim) {
			setError('El correo es obligatorio.');
			return;
		}
		if (wantsPassword && password.length < 8) {
			setError('La contraseña debe tener al menos 8 caracteres.');
			return;
		}
		if (wantsPassword && password !== passwordConfirm) {
			setError('Las contraseñas no coinciden.');
			return;
		}

		setLoading(true);

		try {
			const endpoint =
				mode === 'create' ? '/api/admin/usuarios' : `/api/admin/usuarios/${userId}`;
			const response = await fetch(endpoint, {
				method: mode === 'create' ? 'POST' : 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					nombre: nombreTrim,
					correo: correoTrim,
					password: wantsPassword ? password : '',
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
							autoComplete="name"
							autoFocus
							placeholder="Ana Pérez"
							value={nombre}
							onChange={(event) => setNombre(event.target.value)}
						/>
					</label>

					<label className="admin-form__field admin-form__field--full">
						Correo
						<input
							className="admin-form__input"
							type="email"
							required
							maxLength={160}
							autoComplete="email"
							placeholder="ana@mitienda.com"
							value={correo}
							onChange={(event) => setCorreo(event.target.value)}
						/>
					</label>
				</div>

				{mode === 'edit' ? (
					<button
						type="button"
						className="admin-form__toggle"
						aria-expanded={changePassword}
						onClick={togglePassword}
						disabled={loading}
					>
						<span>Cambiar contraseña</span>
						<IconChevron className={`admin-form__toggle-icon${changePassword ? ' is-open' : ''}`} />
					</button>
				) : null}

				{changePassword ? (
					<div className="admin-form__grid">
						<PasswordField
							label={mode === 'create' ? 'Contraseña' : 'Nueva contraseña'}
							value={password}
							onChange={setPassword}
							placeholder="Mínimo 8 caracteres"
							required={mode === 'create' || changePassword}
							autoFocus={mode === 'edit'}
						/>
						<PasswordField
							label="Confirmar contraseña"
							value={passwordConfirm}
							onChange={setPasswordConfirm}
							placeholder="Repite la contraseña"
							required={mode === 'create' || changePassword}
						/>
					</div>
				) : null}

				<div className="admin-form__actions">
					<button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel} disabled={loading}>
						Cancelar
					</button>
					<button type="submit" className="admin-btn admin-btn--primary" disabled={loading} aria-busy={loading}>
						{loading ? 'Guardando…' : submitLabel}
					</button>
				</div>
			</form>

			{mode === 'edit' && canDelete && onDelete ? (
				<div className="admin-danger">
					<h3 className="admin-danger__title">Eliminar usuario</h3>
					<p className="admin-danger__text">
						Se borra de forma permanente. La acción queda registrada en bitácora.
					</p>
					<button type="button" className="admin-btn admin-btn--danger" onClick={onDelete} disabled={loading}>
						Eliminar
					</button>
				</div>
			) : null}
		</>
	);
}
