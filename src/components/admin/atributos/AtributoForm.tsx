import { useState, type FormEvent, type KeyboardEvent } from 'react';
import {
	ATRIBUTO_TIPOS,
	TIPO_INFO,
	needsOptions,
	type Atributo,
	type AtributoTipo,
} from '@/lib/atributos/shared';
import { IconPlus, IconX } from '../crud/icons';

type Props = {
	mode: 'create' | 'edit';
	values?: Pick<Atributo, 'nombre' | 'tipo' | 'opciones'>;
	atributoId?: string;
	canDelete?: boolean;
	onCancel: () => void;
	onSaved: (item: Atributo) => void;
	onDelete?: () => void;
};

type ApiResponse = {
	error?: string;
	item?: Atributo;
};

export default function AtributoForm({
	mode,
	values,
	atributoId,
	canDelete = false,
	onCancel,
	onSaved,
	onDelete,
}: Props) {
	const [nombre, setNombre] = useState(values?.nombre ?? '');
	const [tipo, setTipo] = useState<AtributoTipo>(values?.tipo ?? 'seleccion_unica');
	const [opciones, setOpciones] = useState(values?.opciones.map((item) => item.valor) ?? []);
	const [draft, setDraft] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submitLabel = mode === 'create' ? 'Crear atributo' : 'Guardar cambios';
	const showOptions = needsOptions(tipo);

	function addOption() {
		const valor = draft.trim();
		if (!valor) return;
		const exists = opciones.some((item) => item.toLowerCase() === valor.toLowerCase());
		if (exists) {
			setError('Esa opción ya está en la lista.');
			return;
		}
		setError('');
		setOpciones((current) => [...current, valor]);
		setDraft('');
	}

	function onDraftKey(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		addOption();
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError('');

		const nombreTrim = nombre.trim();
		if (nombreTrim.length < 2) {
			setError('El nombre es obligatorio. Ej: Talla, Color, Marca.');
			return;
		}
		if (showOptions && opciones.length < 1) {
			setError('Agrega al menos una opción. Ej: S, M, L.');
			return;
		}

		setLoading(true);

		try {
			const endpoint =
				mode === 'create' ? '/api/admin/atributos' : `/api/admin/atributos/${atributoId}`;
			const response = await fetch(endpoint, {
				method: mode === 'create' ? 'POST' : 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					nombre: nombreTrim,
					tipo,
					opciones: showOptions ? opciones : [],
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
							placeholder="Talla, Color, Marca…"
							value={nombre}
							onChange={(event) => setNombre(event.target.value)}
						/>
					</label>

					<fieldset className="admin-form__field admin-form__field--full admin-choice">
						<legend className="admin-choice__legend">¿Cómo lo usa el cliente?</legend>
						<div className="admin-choice__grid">
							{ATRIBUTO_TIPOS.map((item) => {
								const info = TIPO_INFO[item];
								const selected = tipo === item;
								return (
									<label
										key={item}
										className={`admin-choice__card${selected ? ' is-on' : ''}`}
									>
										<input
											type="radio"
											name="atributo-tipo"
											value={item}
											checked={selected}
											onChange={() => setTipo(item)}
										/>
										<strong>{info.label}</strong>
										<small>{info.hint}</small>
										<span>{info.example}</span>
									</label>
								);
							})}
						</div>
					</fieldset>

					{showOptions ? (
						<div className="admin-form__field admin-form__field--full">
							Opciones
							<div className="admin-options">
								<div className="admin-options__add">
									<input
										className="admin-form__input"
										type="text"
										maxLength={40}
										placeholder="Ej: S, M, L o Rojo"
										value={draft}
										onChange={(event) => setDraft(event.target.value)}
										onKeyDown={onDraftKey}
									/>
									<button
										type="button"
										className="admin-btn admin-btn--ghost"
										onClick={addOption}
										disabled={loading}
									>
										<IconPlus />
										Agregar
									</button>
								</div>
								{opciones.length === 0 ? (
									<p className="admin-form__hint">
										Aún no hay opciones. Escribe una y pulsa Agregar o Enter.
									</p>
								) : (
									<ul className="admin-options__list">
										{opciones.map((valor) => (
											<li key={valor} className="admin-options__chip">
												{valor}
												<button
													type="button"
													className="admin-options__remove"
													aria-label={`Quitar ${valor}`}
													onClick={() =>
														setOpciones((current) => current.filter((item) => item !== valor))
													}
												>
													<IconX />
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					) : (
						<p className="admin-form__hint admin-form__hint--box">
							Este dato se escribe cuando armes cada producto. No hace falta agregar opciones.
						</p>
					)}
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

			{mode === 'edit' && canDelete && onDelete ? (
				<div className="admin-danger">
					<h3 className="admin-danger__title">Eliminar atributo</h3>
					<p className="admin-danger__text">
						Se borra junto con sus opciones. No se puede si ya hay productos usándolo.
					</p>
					<button type="button" className="admin-btn admin-btn--danger" onClick={onDelete} disabled={loading}>
						Eliminar
					</button>
				</div>
			) : null}
		</>
	);
}
