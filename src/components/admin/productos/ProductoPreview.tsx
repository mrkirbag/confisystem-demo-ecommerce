import { useEffect, useMemo, useState } from 'react';
import type { Atributo } from '@/lib/atributos/shared';
import {
	COMBINACION_UNICA,
	formatCombinacion,
	formatPrecio,
	formatStock,
	inferVarianteSeleccion,
	initialsFromName,
	parseCombinacion,
	type Producto,
} from '@/lib/productos/shared';

type Props = {
	productoId: string;
	atributos: Atributo[];
	storeName: string;
};

type ApiResponse = {
	error?: string;
	item?: Producto;
};

export default function ProductoPreview({ productoId, atributos, storeName }: Props) {
	const [item, setItem] = useState<Producto | null>(null);
	const [error, setError] = useState('');
	const [photo, setPhoto] = useState(0);
	const [picked, setPicked] = useState<Record<string, string>>({});
	const [qty, setQty] = useState(1);
	const [descOpen, setDescOpen] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setItem(null);
		setError('');
		setPhoto(0);
		setQty(1);

		(async () => {
			try {
				const response = await fetch(`/api/admin/productos/${productoId}`, {
					headers: { Accept: 'application/json' },
				});
				const payload = (await response.json().catch(() => ({}))) as ApiResponse;
				if (!response.ok || !payload.item || !('variantes' in payload.item)) {
					if (!cancelled) setError(payload.error || 'No se pudo cargar el producto.');
					return;
				}
				if (cancelled) return;
				const product = payload.item as Producto;
				setItem(product);

				const inferred = inferVarianteSeleccion(product.variantes, atributos);
				const preferred =
					product.variantes.find((variante) => variante.stock > 0) ?? product.variantes[0];
				const parts = preferred ? parseCombinacion(preferred.combinacion) : [];
				const next: Record<string, string> = {};
				for (const id of inferred.atributoIds) {
					const atributo = atributos.find((row) => row.id === id);
					const fromVariant = parts.find((part) => part.nombre === atributo?.nombre)?.valor;
					next[id] = fromVariant || inferred.opciones[id]?.[0] || '';
				}
				setPicked(next);
			} catch {
				if (!cancelled) setError('No se pudo cargar el producto. Revisa la conexión.');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [productoId, atributos]);

	const inferred = useMemo(
		() => (item ? inferVarianteSeleccion(item.variantes, atributos) : { atributoIds: [], opciones: {} }),
		[item, atributos],
	);

	const groups = useMemo(
		() =>
			inferred.atributoIds
				.map((id) => {
					const atributo = atributos.find((row) => row.id === id);
					if (!atributo) return null;
					return {
						id,
						nombre: atributo.nombre,
						valores: inferred.opciones[id] ?? [],
					};
				})
				.filter((group): group is { id: string; nombre: string; valores: string[] } => Boolean(group)),
		[inferred, atributos],
	);

	const combinacion = useMemo(() => {
		if (groups.length === 0) return COMBINACION_UNICA;
		return formatCombinacion(groups.map((group) => ({ nombre: group.nombre, valor: picked[group.id] || '' })));
	}, [groups, picked]);

	const variante = useMemo(() => {
		if (!item) return null;
		return item.variantes.find((row) => row.combinacion === combinacion) ?? item.variantes[0] ?? null;
	}, [item, combinacion]);

	const fotos = item?.imagenes ?? [];
	const currentPhoto = fotos[photo] ?? fotos[0];

	const extras = useMemo(() => {
		if (!item) return [];
		return item.detalles
			.map((detalle) => {
				const atributo = atributos.find((row) => row.id === detalle.atributo_id);
				if (!atributo) return null;
				return { nombre: atributo.nombre, valor: detalle.valor };
			})
			.filter((row): row is { nombre: string; valor: string } => Boolean(row));
	}, [item, atributos]);

	// LÓGICA DE PRECIOS EXACTA AL STOREFRONT
	const basePrice = Number(item?.precio_base) || 0;
	const isByVariant = Boolean(item?.precio_por_variante);
	const variantPrice =
		variante && isByVariant && Number(variante.precio) > 0
			? Number(variante.precio)
			: basePrice;

	const offerActive = Boolean(item?.en_oferta);
	const variantOffer =
		variante && isByVariant && Number(variante.precio_oferta) > 0
			? Number(variante.precio_oferta)
			: 0;
	const offerPrice = Number(item?.precio_oferta) || 0;

	let regularPrice = variantPrice;
	let salePrice = regularPrice;
	let descuento = 0;
	let hasOffer = false;

	if (offerActive) {
		if (variantOffer > 0 && variantOffer < regularPrice) {
			salePrice = variantOffer;
			hasOffer = true;
			descuento = Math.round((1 - salePrice / regularPrice) * 100);
		} else if (offerPrice > 0 && offerPrice < basePrice) {
			if (regularPrice === basePrice) {
				salePrice = offerPrice;
			} else {
				const ratio = (basePrice - offerPrice) / basePrice;
				salePrice = Math.round(regularPrice * (1 - ratio) * 100) / 100;
			}
			if (regularPrice > salePrice) {
				hasOffer = true;
				descuento = Math.round((1 - salePrice / regularPrice) * 100);
			}
		}
	}

	const esOferta = hasOffer && descuento > 0;
	const listPrice = regularPrice;
	const payPrice = salePrice;

	const stock = variante?.stock ?? 0;
	const disponible = stock > 0;
	const agotado = Boolean(item) && item!.variantes.every((row) => row.stock <= 0);
	const maxQty = Math.max(1, stock);

	function stockForPick(groupId: string, valor: string) {
		if (!item) return 0;
		if (groups.length === 0) return stock;
		const next = { ...picked, [groupId]: valor };
		const combo = formatCombinacion(
			groups.map((group) => ({ nombre: group.nombre, valor: next[group.id] || '' })),
		);
		return item.variantes.find((row) => row.combinacion === combo)?.stock ?? 0;
	}

	useEffect(() => {
		setQty((current) => Math.min(Math.max(1, current), maxQty));
	}, [maxQty, combinacion]);

	if (error) {
		return (
			<div className="pdp-sold-alert" style={{ margin: '1.5rem 0' }}>
				<p>{error}</p>
			</div>
		);
	}

	if (!item) {
		return (
			<div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: '1.5rem', padding: '1rem 0' }}>
				<div style={{ aspectRatio: '1/1', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', borderRadius: '1rem', animation: 'pulse 1.5s infinite ease-in-out' }} />
				<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
					<div style={{ height: '1.5rem', width: '40%', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', borderRadius: '4px' }} />
					<div style={{ height: '2.5rem', width: '85%', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', borderRadius: '4px' }} />
					<div style={{ height: '2rem', width: '35%', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', borderRadius: '4px' }} />
					<div style={{ height: '3.5rem', width: '100%', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', borderRadius: '8px' }} />
				</div>
			</div>
		);
	}

	const storeInitial = storeName ? storeName.charAt(0).toUpperCase() : 'T';

	return (
		<div className="pdp-preview-container" style={{ position: 'relative' }}>
			{/* ALERTA DE PRODUCTO INACTIVO */}
			{!item.activo ? (
				<div
					style={{
						marginBottom: '1rem',
						padding: '0.65rem 1rem',
						borderRadius: '8px',
						background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
						border: '1px solid #f59e0b',
						color: '#b45309',
						fontSize: '0.86rem',
						fontWeight: 600,
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
					}}
				>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
						<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
					</svg>
					<span>Este producto está marcado como inactivo. Los clientes no lo verán en la tienda online.</span>
				</div>
			) : null}

			{/* RUTA DE NAVEGACIÓN ESTILO STOREFRONT */}
			<div className="pdp-nav-strip" style={{ marginBottom: '1rem' }}>
				<nav className="pdp-breadcrumbs" aria-label="Ruta de navegación">
					<span>Inicio</span>
					{item.categoria_nombre && (
						<>
							<span className="sep">/</span>
							<span>{item.categoria_nombre}</span>
						</>
					)}
					{item.subcategoria_nombre && (
						<>
							<span className="sep">/</span>
							<span className="current">{item.subcategoria_nombre}</span>
						</>
					)}
				</nav>
			</div>

			{/* GRID PRINCIPAL ESTILO MERCADO LIBRE */}
			<div className="pdp-main-grid" style={{ maxWidth: '100%' }}>
				{/* COLUMNA IZQUIERDA: GALERÍA */}
				<div className="pdp-box pdp-box-pad pdp-gallery-card">
					<div className="pdp-gallery-wrap">
						{fotos.length > 1 && (
							<div className="pdp-thumbs-col" role="list" aria-label="Galería de fotos">
								{fotos.map((img, index) => (
									<button
										key={img.id}
										type="button"
										role="listitem"
										className={`pdp-thumb-item${index === photo ? ' is-active' : ''}`}
										aria-label={`Ver foto ${index + 1}`}
										onClick={() => setPhoto(index)}
									>
										<img src={img.url} alt="" loading="lazy" />
									</button>
								))}
							</div>
						)}

						<div className={`pdp-hero-container${!disponible ? ' is-sold-out' : ''}`}>
							<div className="pdp-badge-stack">
								{item.es_tendencia && <span className="pdp-badge pdp-badge--trend">Más Vendido</span>}
								{esOferta && <span className="pdp-badge pdp-badge--sale">-{descuento}% OFF</span>}
							</div>

							{currentPhoto ? (
								<img className="pdp-hero-img" src={currentPhoto.url} alt={item.nombre} />
							) : (
								<span className="pdp-hero-fallback">{initialsFromName(item.nombre)}</span>
							)}

							{!disponible && (
								<div className="pdp-hero-sold">
									<span>{agotado ? 'Agotado' : 'Sin stock disponible'}</span>
								</div>
							)}
						</div>
					</div>

					{fotos.length > 1 && (
						<div className="pdp-hero-dots" aria-hidden="true">
							{fotos.map((_, index) => (
								<span
									key={index}
									className={`pdp-hero-dot${index === photo ? ' is-active' : ''}`}
									onClick={() => setPhoto(index)}
									style={{ cursor: 'pointer' }}
								/>
							))}
						</div>
					)}
				</div>

				{/* COLUMNA DERECHA: ASIDE (BUY CARD + DETALLES + INFORMACIÓN DE TIENDA) */}
				<aside className="pdp-aside">
					{/* CAJA DE COMPRA (BUY CARD) */}
					<div className="pdp-box pdp-buy-card">
						{/* ESTADO Y CALIFICACIÓN */}
						<div className="pdp-meta-row">
							<div className="pdp-rating" aria-label="Calificación 5.0 de 5">
								<span className="pdp-stars">
									{[...Array(5)].map((_, i) => (
										<svg key={i} viewBox="0 0 20 20" fill="currentColor">
											<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
										</svg>
									))}
								</span>
								<span>5.0</span>
							</div>
						</div>

						{/* TÍTULO */}
						<h1 className="pdp-title">{item.nombre}</h1>

						{/* PRECIO */}
						<div className="pdp-price-wrap">
							{esOferta && <p className="pdp-price-old">{formatPrecio(listPrice)}</p>}
							<div className="pdp-price-current-row">
								<span className="pdp-price-big">{formatPrecio(payPrice)}</span>
								{esOferta && <span className="pdp-save-badge">{descuento}% OFF</span>}
							</div>
						</div>

						{/* VARIANTES */}
						{groups.length > 0 && (
							<div className="pdp-variants-wrap">
								{groups.map((group) => (
									<div key={group.id} className="pdp-variant-group">
										<div className="pdp-variant-label">
											<strong>{group.nombre}:</strong>
											<span>{picked[group.id] || ''}</span>
										</div>
										<div className="pdp-variant-pills" role="group">
											{group.valores.map((valor) => {
												const active = picked[group.id] === valor;
												const pickStock = stockForPick(group.id, valor);
												return (
													<button
														key={valor}
														type="button"
														className={`pdp-variant-pill${active ? ' is-active' : ''}${pickStock <= 0 ? ' is-disabled' : ''}`}
														onClick={() => setPicked((curr) => ({ ...curr, [group.id]: valor }))}
													>
														{valor}
													</button>
												);
											})}
										</div>
									</div>
								))}
							</div>
						)}

						{/* STOCK Y CANTIDAD */}
						<div className="pdp-stock-block">
							<div className="pdp-stock-header">
								<p className="pdp-stock-title">
									<span className={`pdp-stock-dot${!disponible ? ' is-out' : ''}`} />
									<span>{disponible ? 'Stock disponible' : 'Sin stock disponible'}</span>
								</p>
							</div>

							{disponible && (
								<div className="pdp-stock-row">
									<div className="pdp-qty-line">
										<span className="pdp-qty-label">Cantidad:</span>
										<div className="pdp-qty-stepper">
											<button
												type="button"
												className="pdp-qty-btn"
												disabled={qty <= 1}
												onClick={() => setQty((c) => Math.max(1, c - 1))}
												aria-label="Restar una unidad"
											>
												−
											</button>
											<span className="pdp-qty-number">{qty}</span>
											<button
												type="button"
												className="pdp-qty-btn"
												disabled={qty >= stock}
												onClick={() => setQty((c) => Math.min(stock, c + 1))}
												aria-label="Sumar una unidad"
											>
												+
											</button>
										</div>
										<span className="pdp-stock-count">
											{stock === 1 ? '(¡Última disponible!)' : `(${formatStock(stock)} disponibles)`}
										</span>
									</div>
								</div>
							)}
						</div>

						{/* BOTONES DE ACCIÓN */}
						{disponible ? (
							<div className="pdp-actions-area">
								<button
									type="button"
									className="pdp-btn-cart"
									disabled
									style={{ opacity: 0.95 }}
									title="Vista previa para el cliente"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
										<path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
									</svg>
									<span>Agregar al carrito</span>
								</button>

								<span
									className="pdp-btn-ask"
									style={{ cursor: 'default', textDecoration: 'none' }}
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
										<path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
									<span>Preguntar a la tienda</span>
								</span>
							</div>
						) : (
							<div className="pdp-sold-alert">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
									<circle cx="12" cy="12" r="10" />
									<line x1="12" y1="8" x2="12" y2="12" />
									<line x1="12" y1="16" x2="12.01" y2="16" />
								</svg>
								<div>
									<strong>Sin inventario disponible</strong>
									<p>
										{agotado
											? 'El producto se encuentra completamente agotado.'
											: 'Esta combinación no tiene unidades disponibles.'}
									</p>
								</div>
							</div>
						)}

						{/* BENEFICIOS / TRUST LIST */}
						<div className="pdp-trust-list">
							<div className="pdp-trust-item">
								<svg className="pdp-trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
									<rect x="1" y="3" width="15" height="13" />
									<polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
									<circle cx="5.5" cy="18.5" r="2.5" />
									<circle cx="18.5" cy="18.5" r="2.5" />
								</svg>
								<div className="pdp-trust-content">
									<strong>Envíos y entregas</strong>
								</div>
							</div>

							<div className="pdp-trust-item">
								<svg className="pdp-trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
									<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
								<div className="pdp-trust-content">
									<strong>Compra Protegida</strong>
								</div>
							</div>

							<div className="pdp-trust-item">
								<svg className="pdp-trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 14 14" />
								</svg>
								<div className="pdp-trust-content">
									<strong>Garantía del vendedor</strong>
								</div>
							</div>
						</div>
					</div>

					{/* DESCRIPCIÓN Y ESPECIFICACIONES */}
					{(item.descripcion || extras.length > 0) && (
						<div className="pdp-box pdp-box-pad pdp-details-box">
							{item.descripcion && (
								<details className="pdp-accordion pdp-description-accordion" open={descOpen} onToggle={(e) => setDescOpen(e.currentTarget.open)}>
									<summary className="pdp-accordion-summary">
										<h2 className="pdp-section-title">Descripción</h2>
										<span className="pdp-accordion-chevron-wrap" aria-hidden="true">
											<svg className="pdp-accordion-chevron" viewBox="0 0 20 20" fill="currentColor">
												<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
											</svg>
										</span>
									</summary>
									<div className="pdp-accordion-content">
										<div className="pdp-description-body">
											<p>{item.descripcion}</p>
										</div>
									</div>
								</details>
							)}

							{item.descripcion && extras.length > 0 && <hr className="pdp-section-divider" />}

							{extras.length > 0 && (
								<section className="pdp-specs-section">
									<h2 className="pdp-section-title">Características principales</h2>
									<dl className="pdp-specs-grid">
										{extras.map((row) => (
											<div key={row.nombre} className="pdp-spec-row">
												<dt className="pdp-spec-term">{row.nombre}</dt>
												<dd className="pdp-spec-desc">{row.valor}</dd>
											</div>
										))}
									</dl>
								</section>
							)}
						</div>
					)}

					{/* CAJA DE INFORMACIÓN DEL VENDEDOR */}
					<div className="pdp-box pdp-seller-box">
						<p className="pdp-reputation-title">Información de la tienda</p>
						<div className="pdp-seller-header">
							<div className="pdp-seller-avatar">
								<span>{storeInitial}</span>
							</div>
							<div>
								<h3 className="pdp-seller-name">{storeName}</h3>
								<span className="pdp-seller-badge">Tienda Oficial Verificada</span>
							</div>
						</div>

						<div className="pdp-thermometer" aria-label="Nivel de reputación 5 de 5">
							<span className="pdp-thermo-bar lvl-1" />
							<span className="pdp-thermo-bar lvl-2" />
							<span className="pdp-thermo-bar lvl-3" />
							<span className="pdp-thermo-bar lvl-4" />
							<span className="pdp-thermo-bar lvl-5" />
						</div>

						<div className="pdp-seller-metrics">
							<div>
								<p className="pdp-metric-val">+500</p>
								<p className="pdp-metric-lbl">Ventas concretadas</p>
							</div>
							<div>
								<p className="pdp-metric-val">Excelente</p>
								<p className="pdp-metric-lbl">Buena atención</p>
							</div>
							<div>
								<p className="pdp-metric-val">A tiempo</p>
								<p className="pdp-metric-lbl">Despacha rápido</p>
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
