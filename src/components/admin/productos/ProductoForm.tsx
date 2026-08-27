import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Atributo } from '@/lib/atributos/shared';
import type { Categoria } from '@/lib/categorias/shared';
import { isValidSlug, slugify } from '@/lib/categorias/shared';
import {
	COMBINACION_UNICA,
	MAX_COMBINACIONES,
	PRODUCT_SLOTS,
	allocateSkus,
	cartesianCombinaciones,
	inferVarianteSeleccion,
	type Producto,
	type ProductoListado,
	type ProductSlot,
} from '@/lib/productos/shared';
import ImageUpload from '../crud/ImageUpload';

type Props = {
	mode: 'create' | 'edit';
	productoId?: string;
	categorias: Categoria[];
	atributos: Atributo[];
	canDeactivate?: boolean;
	onCancel: () => void;
	onSaved: (item: ProductoListado) => void;
	onDeactivate?: () => void;
};

type ApiResponse = {
	error?: string;
	item?: ProductoListado | Producto;
};

type SlotState = {
	orden: ProductSlot;
	url: string | null;
	file: File | null;
	fileName: string;
};

type VarianteDraft = {
	stock: string;
	sku: string;
	precio: string;
};

function emptySlots(): SlotState[] {
	return PRODUCT_SLOTS.map((orden) => ({
		orden,
		url: null,
		file: null,
		fileName: '',
	}));
}

function toggleValue(list: string[], value: string) {
	return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function PickChip({
	on,
	children,
	onToggle,
}: {
	on: boolean;
	children: ReactNode;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			className={`admin-picks__item${on ? ' is-on' : ''}`}
			aria-pressed={on}
			onClick={onToggle}
		>
			{children}
		</button>
	);
}

function ToggleSwitch({
	on,
	title,
	hint,
	onToggle,
}: {
	on: boolean;
	title: string;
	hint: string;
	onToggle: () => void;
}) {
	return (
		<button type="button" className={`admin-switch${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onToggle}>
			<span className="admin-switch__track" aria-hidden="true">
				<span className="admin-switch__thumb" />
			</span>
			<span className="admin-switch__copy">
				<strong>{title}</strong>
				<small>{hint}</small>
			</span>
		</button>
	);
}

export default function ProductoForm({
	mode,
	productoId,
	categorias,
	atributos,
	canDeactivate = false,
	onCancel,
	onSaved,
	onDeactivate,
}: Props) {
	const activas = categorias.filter((item) => item.activo);
	const unicas = atributos.filter((item) => item.tipo === 'seleccion_unica' && item.opciones.length > 0);
	const extras = atributos.filter((item) => item.tipo !== 'seleccion_unica');

	const [ready, setReady] = useState(mode === 'create');
	const [loadError, setLoadError] = useState('');
	const [categoriaId, setCategoriaId] = useState(activas[0]?.id ?? '');
	const [nombre, setNombre] = useState('');
	const [slug, setSlug] = useState('');
	const [slugLocked, setSlugLocked] = useState(mode === 'edit');
	const [descripcion, setDescripcion] = useState('');
	const [precio, setPrecio] = useState('');
	const [esTendencia, setEsTendencia] = useState(false);
	const [enOferta, setEnOferta] = useState(false);
	const [precioPorVariante, setPrecioPorVariante] = useState(false);
	const [precioOferta, setPrecioOferta] = useState('');
	const [slots, setSlots] = useState<SlotState[]>(emptySlots);
	const [varianteAttrs, setVarianteAttrs] = useState<string[]>([]);
	const [varianteOpciones, setVarianteOpciones] = useState<Record<string, string[]>>({});
	const [variantes, setVariantes] = useState<Record<string, VarianteDraft>>({
		[COMBINACION_UNICA]: { stock: '0', sku: '', precio: '' },
	});
	const [textos, setTextos] = useState<Record<string, string>>({});
	const [multiples, setMultiples] = useState<Record<string, string[]>>({});
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);

	const submitLabel = mode === 'create' ? 'Crear producto' : 'Guardar cambios';

	const categoriaOptions = useMemo(() => {
		const ids = new Set(activas.map((item) => item.id));
		if (categoriaId && !ids.has(categoriaId)) {
			const current = categorias.find((item) => item.id === categoriaId);
			return current ? [current, ...activas] : activas;
		}
		return activas;
	}, [activas, categorias, categoriaId]);

	const combinaciones = useMemo(() => {
		const grupos = unicas
			.filter((item) => varianteAttrs.includes(item.id))
			.map((item) => ({
				nombre: item.nombre,
				valores: varianteOpciones[item.id] ?? [],
			}));
		return cartesianCombinaciones(grupos);
	}, [unicas, varianteAttrs, varianteOpciones]);

	const skuMap = useMemo(() => {
		const existing: Record<string, string> = {};
		for (const combinacion of combinaciones) {
			const sku = variantes[combinacion]?.sku?.trim();
			if (sku) existing[combinacion] = sku;
		}
		return allocateSkus(slug, combinaciones, existing);
	}, [slug, combinaciones, variantes]);

	const puedePrecioPorVariante = combinaciones.length > 1;
	const usarPrecioPorVariante = puedePrecioPorVariante && precioPorVariante;

	useEffect(() => {
		if (slugLocked) return;
		setSlug(slugify(nombre));
	}, [nombre, slugLocked]);

	useEffect(() => {
		if (!error) return;
		alertRef.current?.scrollIntoView({ block: 'nearest' });
	}, [error]);

	useEffect(() => {
		if (mode !== 'edit' || !productoId) return;
		let cancelled = false;

		(async () => {
			try {
				const response = await fetch(`/api/admin/productos/${productoId}`, {
					headers: { Accept: 'application/json' },
				});
				const payload = (await response.json().catch(() => ({}))) as ApiResponse;
				if (!response.ok || !payload.item || !('variantes' in payload.item)) {
					if (!cancelled) setLoadError(payload.error || 'No se pudo cargar el producto.');
					return;
				}

				const item = payload.item as Producto;
				if (cancelled) return;

				setCategoriaId(item.categoria_id);
				setNombre(item.nombre);
				setSlug(item.slug);
				setDescripcion(item.descripcion);
				setPrecio(String(item.precio_base));
				setEsTendencia(item.es_tendencia);
				setEnOferta(item.en_oferta);
				setPrecioPorVariante(item.precio_por_variante);
				setPrecioOferta(item.en_oferta && item.precio_oferta > 0 ? String(item.precio_oferta) : '');
				setSlots(
					PRODUCT_SLOTS.map((orden) => {
						const found = item.imagenes.find((img) => img.orden === orden);
						return {
							orden,
							url: found?.url ?? null,
							file: null,
							fileName: '',
						};
					}),
				);

				const inferred = inferVarianteSeleccion(item.variantes, atributos);
				setVarianteAttrs(inferred.atributoIds);
				setVarianteOpciones(inferred.opciones);
				setVariantes(
					Object.fromEntries(
						item.variantes.map((variante) => [
							variante.combinacion,
							{
								stock: String(variante.stock),
								sku: variante.sku,
								precio: String(variante.precio),
							},
						]),
					),
				);

				const extraAttrs = atributos.filter((itemAttr) => itemAttr.tipo !== 'seleccion_unica');
				const nextTextos: Record<string, string> = {};
				const nextMultiples: Record<string, string[]> = {};
				for (const detalle of item.detalles) {
					const atributo = extraAttrs.find((itemAttr) => itemAttr.id === detalle.atributo_id);
					if (!atributo) continue;
					if (atributo.tipo === 'multiseleccion') {
						nextMultiples[atributo.id] = detalle.valor
							.split(',')
							.map((value) => value.trim())
							.filter(Boolean);
					} else {
						nextTextos[atributo.id] = detalle.valor;
					}
				}
				setTextos(nextTextos);
				setMultiples(nextMultiples);
				setReady(true);
			} catch {
				if (!cancelled) setLoadError('No se pudo cargar el producto. Revisa la conexión.');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [mode, productoId, atributos]);

	function setSlot(orden: ProductSlot, patch: Partial<SlotState>) {
		setSlots((current) =>
			current.map((slot) => (slot.orden === orden ? { ...slot, ...patch } : slot)),
		);
	}

	function toggleAtributo(id: string) {
		setVarianteAttrs((current) => {
			const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
			if (!current.includes(id)) {
				const atributo = unicas.find((item) => item.id === id);
				if (atributo) {
					setVarianteOpciones((opts) => ({
						...opts,
						[id]: atributo.opciones.map((opcion) => opcion.valor),
					}));
				}
			}
			return next;
		});
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError('');

		const nombreTrim = nombre.trim();
		const slugTrim = slugify(slug.trim() || nombreTrim);
		const existingSkus: Record<string, string> = {};
		for (const combinacion of combinaciones) {
			const kept = variantes[combinacion]?.sku?.trim();
			if (kept) existingSkus[combinacion] = kept;
		}
		const assignedSkus = allocateSkus(slugTrim, combinaciones, existingSkus);

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

		const precioBase = Number(precio);
		if (!Number.isFinite(precioBase) || precioBase < 0) {
			setError('El precio no es válido.');
			return;
		}

		const oferta = Number(precioOferta);
		if (enOferta && (!Number.isFinite(oferta) || oferta <= 0 || oferta >= precioBase)) {
			setError('El precio de oferta debe ser menor que el precio normal.');
			return;
		}

		if (combinaciones.length === 0) {
			setError(`Demasiadas combinaciones. El máximo es ${MAX_COMBINACIONES}. Quita opciones.`);
			return;
		}

		const variantesPayload = combinaciones.map((combinacion) => {
			const draft = variantes[combinacion];
			const rawPrecio = (draft?.precio ?? '').trim();
			return {
				combinacion,
				stock: Number(draft?.stock ?? 0),
				sku: assignedSkus[combinacion] ?? '',
				precio: usarPrecioPorVariante && rawPrecio !== '' ? Number(rawPrecio) : precioBase,
			};
		});

		if (variantesPayload.some((item) => !Number.isFinite(item.stock) || item.stock < 0)) {
			setError('Revisa el stock: debe ser 0 o más.');
			return;
		}
		if (variantesPayload.some((item) => !Number.isFinite(item.precio) || item.precio < 0)) {
			setError('Revisa el precio de cada combinación.');
			return;
		}

		if (enOferta) {
			const minimo = usarPrecioPorVariante
				? Math.min(precioBase, ...variantesPayload.map((item) => item.precio))
				: precioBase;
			if (oferta >= minimo) {
				setError(
					usarPrecioPorVariante
						? 'El precio de oferta debe ser menor que el precio más bajo de las variantes.'
						: 'El precio de oferta debe ser menor que el precio normal.',
				);
				return;
			}
		}

		const detalles = extras
			.map((atributo) => {
				if (atributo.tipo === 'multiseleccion') {
					const valores = multiples[atributo.id] ?? [];
					return valores.length > 0
						? { atributo_id: atributo.id, valor: valores.join(', ') }
						: null;
				}
				const valor = (textos[atributo.id] ?? '').trim();
				return valor ? { atributo_id: atributo.id, valor } : null;
			})
			.filter((item): item is { atributo_id: string; valor: string } => Boolean(item));

		setLoading(true);

		try {
			const imagenes: { orden: ProductSlot; url: string }[] = [];

			for (const slot of slots) {
				if (slot.file) {
					const uploadData = new FormData();
					uploadData.append('kind', 'producto');
					uploadData.append('slug', slugTrim);
					uploadData.append('slot', String(slot.orden));
					uploadData.append('file', slot.file);

					const uploaded = await fetch('/api/admin/upload', {
						method: 'POST',
						headers: { Accept: 'application/json' },
						body: uploadData,
					});
					const body = (await uploaded.json().catch(() => ({}))) as { error?: string; url?: string };
					if (!uploaded.ok || !body.url) {
						setError(body.error || `No se pudo subir la foto ${slot.orden}.`);
						setLoading(false);
						return;
					}
					imagenes.push({ orden: slot.orden, url: body.url });
					setSlot(slot.orden, { url: body.url, file: null, fileName: slot.file.name });
				} else if (slot.url) {
					imagenes.push({ orden: slot.orden, url: slot.url });
				}
			}

			const endpoint =
				mode === 'create' ? '/api/admin/productos' : `/api/admin/productos/${productoId}`;
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
					descripcion: descripcion.trim(),
					precio_base: precioBase,
					es_tendencia: esTendencia,
					en_oferta: enOferta,
					precio_oferta: enOferta ? oferta : 0,
					precio_por_variante: usarPrecioPorVariante,
					imagenes,
					variantes: variantesPayload,
					detalles,
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

	if (loadError) {
		return (
			<div className="admin-form admin-form--stack">
				<div className="admin-form__alert is-visible" role="alert">
					{loadError}
				</div>
				<div className="admin-form__actions">
					<button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel}>
						Cerrar
					</button>
				</div>
			</div>
		);
	}

	if (!ready) {
		return <p className="admin-form__hint">Cargando producto…</p>;
	}

	if (categoriaOptions.length === 0) {
		return (
			<div className="admin-form admin-form--stack">
				<p className="admin-form__hint admin-form__hint--box">
					Primero crea una categoría activa. Sin ella no se puede publicar un producto.
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
					<div ref={alertRef} className="admin-form__alert is-visible" role="alert">
						{error}
					</div>
				) : null}

				<section className="admin-form__block">
					<h3 className="admin-form__legend">Datos</h3>
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
								maxLength={120}
								autoFocus
								placeholder="Camisa de lino"
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
								placeholder="camisa-de-lino"
								value={slug}
								onChange={(event) => {
									setSlugLocked(true);
									setSlug(slugify(event.target.value));
								}}
							/>
						</label>

						<label className="admin-form__field admin-form__field--full">
							Descripción
							<textarea
								className="admin-form__input admin-form__textarea"
								rows={4}
								maxLength={4000}
								placeholder="Tela, corte, cuidados…"
								value={descripcion}
								onChange={(event) => setDescripcion(event.target.value)}
							/>
						</label>

						<div className="admin-form__row">
							<label className="admin-form__field">
								Precio USD
								<input
									className="admin-form__input"
									type="number"
									required
									min={0}
									step="0.01"
									inputMode="decimal"
									placeholder="0.00"
									autoComplete="off"
									value={precio}
									onChange={(event) => setPrecio(event.target.value)}
								/>
								<span className="admin-form__hint">
									Precio USD de partida. Si cambia por talla o color, actívalo más abajo.
								</span>
							</label>
						</div>
					</div>
				</section>

				<section className="admin-form__block">
					<h3 className="admin-form__legend">Imágenes</h3>
					<p className="admin-form__hint">Hasta 3 fotos. La primera es la portada.</p>
					<div className="admin-gallery">
						{slots.map((slot) => (
							<ImageUpload
								key={slot.orden}
								compact
								label={`Foto ${slot.orden}`}
								previewUrl={slot.url}
								fileName={slot.fileName}
								disabled={loading}
								onFile={(file) => setSlot(slot.orden, { file, fileName: file.name })}
								onClear={() => setSlot(slot.orden, { url: null, file: null, fileName: '' })}
							/>
						))}
					</div>
				</section>

				<section className="admin-form__block">
					<h3 className="admin-form__legend">Destacar</h3>
					<div className="admin-form__switches">
						<ToggleSwitch
							on={esTendencia}
							title="Tendencia"
							hint="Se muestra en destacados."
							onToggle={() => setEsTendencia((current) => !current)}
						/>
						<ToggleSwitch
							on={enOferta}
							title="En oferta"
							hint="Usa un precio USD promocional."
							onToggle={() => setEnOferta((current) => !current)}
						/>
					</div>
					{enOferta ? (
						<label className="admin-form__field">
							Precio de oferta USD
							<input
								className="admin-form__input"
								type="number"
								required
								min={0}
								step="0.01"
								inputMode="decimal"
								placeholder="0.00"
								autoComplete="off"
								value={precioOferta}
								onChange={(event) => setPrecioOferta(event.target.value)}
							/>
							<span className="admin-form__hint">Debe ser menor que el precio USD normal.</span>
						</label>
					) : null}
				</section>

				<section className="admin-form__block">
					<h3 className="admin-form__legend">Variantes y stock</h3>
					{unicas.length === 0 ? (
						<p className="admin-form__hint admin-form__hint--box">
							Este producto se vende de una sola forma: un stock y un SKU. Si tiene talla, color u otra
							opción que el cliente elige, créala antes en{' '}
							<a href="/admin/catalogo/atributos">Atributos</a> con el tipo “Elige una”.
						</p>
					) : (
						<>
							<p className="admin-form__hint">
								Si el cliente elige talla, color u otra opción, marca cuáles aplican a este producto.
								Cada combinación tiene su propio stock y SKU. Si no marcas ninguna, el producto queda
								con un solo código.
							</p>
							<div className="admin-picks">
								{unicas.map((item) => (
									<PickChip
										key={item.id}
										on={varianteAttrs.includes(item.id)}
										onToggle={() => toggleAtributo(item.id)}
									>
										{item.nombre}
									</PickChip>
								))}
							</div>
							{unicas
								.filter((item) => varianteAttrs.includes(item.id))
								.map((item) => (
									<div key={item.id} className="admin-form__field">
										¿Qué {item.nombre.toLowerCase()} tiene este producto?
										<div className="admin-picks">
											{item.opciones.map((opcion) => (
												<PickChip
													key={opcion.id}
													on={(varianteOpciones[item.id] ?? []).includes(opcion.valor)}
													onToggle={() =>
														setVarianteOpciones((current) => ({
															...current,
															[item.id]: toggleValue(current[item.id] ?? [], opcion.valor),
														}))
													}
												>
													{opcion.valor}
												</PickChip>
											))}
										</div>
									</div>
								))}
						</>
					)}

					{puedePrecioPorVariante ? (
						<ToggleSwitch
							on={precioPorVariante}
							title="Precio USD distinto por combinación"
							hint="Actívalo si XL, un color u otra opción cuesta diferente. Si no, todas usan el mismo precio USD."
							onToggle={() => setPrecioPorVariante((current) => !current)}
						/>
					) : null}

					{combinaciones.length === 0 ? (
						<p className="admin-form__hint admin-form__hint--box">
							Demasiadas combinaciones (máximo {MAX_COMBINACIONES}). Quita opciones.
						</p>
					) : (
						<div className={`admin-variants${usarPrecioPorVariante ? ' admin-variants--priced' : ''}`}>
							{usarPrecioPorVariante ? (
								<p className="admin-form__hint">
									Cambia el precio USD solo en las combinaciones que cuesten distinto.
								</p>
							) : null}
							<p className="admin-form__hint">
								El SKU se genera solo. Negro/M y Negro/L son códigos distintos; si no hay variantes,
								también se asigna uno. No cambia después de guardar.
							</p>
							<div className="admin-variants__head">
								<span>Combinación</span>
								{usarPrecioPorVariante ? <span>Precio USD</span> : null}
								<span>Stock</span>
								<span>SKU</span>
							</div>
							{combinaciones.map((combinacion) => {
								const draft = variantes[combinacion] ?? { stock: '0', sku: '', precio: '' };
								const sku = slug.trim() ? skuMap[combinacion] : 'Se asigna al guardar';
								return (
									<div key={combinacion} className="admin-variants__row">
										<span className="admin-variants__combo">{combinacion}</span>
										{usarPrecioPorVariante ? (
											<input
												className="admin-form__input"
												type="number"
												min={0}
												step="0.01"
												inputMode="decimal"
												aria-label={`Precio USD ${combinacion}`}
												placeholder={precio || '0.00'}
												value={draft.precio === '' ? precio : draft.precio}
												onChange={(event) =>
													setVariantes((current) => ({
														...current,
														[combinacion]: { ...draft, precio: event.target.value },
													}))
												}
											/>
										) : null}
										<input
											className="admin-form__input"
											type="number"
											min={0}
											step={1}
											inputMode="numeric"
											aria-label={`Stock ${combinacion}`}
											value={draft.stock}
											onChange={(event) =>
												setVariantes((current) => ({
													...current,
													[combinacion]: { ...draft, stock: event.target.value },
												}))
											}
										/>
										<span
											className={`admin-variants__sku${slug.trim() ? '' : ' is-pending'}`}
											title={sku}
											aria-label={`SKU ${combinacion}`}
										>
											{sku}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</section>

				{extras.length > 0 ? (
					<section className="admin-form__block">
						<h3 className="admin-form__legend">Otros datos</h3>
						<p className="admin-form__hint">
							Información fija de este producto: material, marca, peso… No cambia el stock ni crea
							combinaciones.
						</p>
						<div className="admin-form__grid">
							{extras.map((atributo) => {
								if (atributo.tipo === 'multiseleccion') {
									const selected = multiples[atributo.id] ?? [];
									return (
										<div key={atributo.id} className="admin-form__field admin-form__field--full">
											{atributo.nombre}
											<div className="admin-picks">
												{atributo.opciones.map((opcion) => (
													<PickChip
														key={opcion.id}
														on={selected.includes(opcion.valor)}
														onToggle={() =>
															setMultiples((current) => ({
																...current,
																[atributo.id]: toggleValue(selected, opcion.valor),
															}))
														}
													>
														{opcion.valor}
													</PickChip>
												))}
											</div>
										</div>
									);
								}

								return (
									<label key={atributo.id} className="admin-form__field admin-form__field--full">
										{atributo.nombre}
										<input
											className="admin-form__input"
											type={atributo.tipo === 'numero' ? 'number' : 'text'}
											step={atributo.tipo === 'numero' ? 'any' : undefined}
											maxLength={400}
											value={textos[atributo.id] ?? ''}
											onChange={(event) =>
												setTextos((current) => ({
													...current,
													[atributo.id]: event.target.value,
												}))
											}
										/>
									</label>
								);
							})}
						</div>
					</section>
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

			{mode === 'edit' && canDeactivate && onDeactivate ? (
				<div className="admin-danger">
					<h3 className="admin-danger__title">Eliminar producto</h3>
					<p className="admin-danger__text">
						Sale del listado y de la tienda. Puedes verlo en Eliminados y restaurarlo.
					</p>
					<button type="button" className="admin-btn admin-btn--danger" onClick={onDeactivate} disabled={loading}>
						Eliminar
					</button>
				</div>
			) : null}
		</>
	);
}
