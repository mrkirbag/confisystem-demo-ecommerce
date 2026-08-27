import { useEffect, useMemo, useState } from 'react';
import type { Atributo } from '@/lib/atributos/shared';
import {
	COMBINACION_UNICA,
	descuentoPorcentaje,
	formatCombinacion,
	formatPrecio,
	formatStock,
	inferVarianteSeleccion,
	initialsFromName,
	parseCombinacion,
	type Producto,
} from '@/lib/productos/shared';
import { IconWhatsApp } from '../crud/icons';

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

	const variante = item?.variantes.find((row) => row.combinacion === combinacion) ?? item?.variantes[0] ?? null;
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

	const listPrice = variante
		? item?.precio_por_variante
			? variante.precio
			: item?.precio_base ?? 0
		: item?.precio_base ?? 0;
	const offer = Boolean(item?.en_oferta && item.precio_oferta > 0);
	const payPrice = offer ? item!.precio_oferta : listPrice;
	const off = offer ? descuentoPorcentaje(listPrice, payPrice) : 0;
	const stock = variante?.stock ?? 0;
	const available = stock > 0;
	const soldOut = Boolean(item) && item!.variantes.every((row) => row.stock <= 0);
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
		return <p className="store-pdp__status">{error}</p>;
	}

	if (!item) {
		return (
			<div className="store-pdp store-pdp--loading" aria-busy="true">
				<div className="store-pdp__skeleton store-pdp__skeleton--media" />
				<div className="store-pdp__skeleton-copy">
					<div className="store-pdp__skeleton store-pdp__skeleton--line" />
					<div className="store-pdp__skeleton store-pdp__skeleton--line is-short" />
					<div className="store-pdp__skeleton store-pdp__skeleton--line is-price" />
				</div>
			</div>
		);
	}

	return (
		<div className="store-pdp">
			{!item.activo ? (
				<p className="store-pdp__banner">Eliminado: el cliente no lo verá en la tienda.</p>
			) : null}

			<div className="store-pdp__chrome" aria-hidden="true">
				<span className="store-pdp__brand">{storeName}</span>
				<span className="store-pdp__crumb">
					Catálogo <span>/</span> {item.categoria_nombre} <span>/</span> {item.nombre}
				</span>
			</div>

			<div className="store-pdp__layout">
				<div className="store-pdp__gallery">
					<div className={`store-pdp__hero${!available ? ' is-sold' : ''}`}>
						{currentPhoto ? (
							<img src={currentPhoto.url} alt={item.nombre} />
						) : (
							<span className="store-pdp__hero-fallback">{initialsFromName(item.nombre)}</span>
						)}
						<div className="store-pdp__flags">
							{item.es_tendencia ? <span className="store-pdp__flag">Tendencia</span> : null}
							{offer ? <span className="store-pdp__flag store-pdp__flag--offer">Oferta</span> : null}
						</div>
						{!available ? (
							<span className="store-pdp__sold">{soldOut ? 'Agotado' : 'Esta combinación está agotada'}</span>
						) : null}
					</div>
					{fotos.length > 1 ? (
						<div className="store-pdp__thumbs">
							{fotos.map((img, index) => (
								<button
									key={img.id}
									type="button"
									className={`store-pdp__thumb${index === photo ? ' is-on' : ''}`}
									aria-label={`Foto ${index + 1}`}
									aria-pressed={index === photo}
									onClick={() => setPhoto(index)}
								>
									<img src={img.url} alt="" />
								</button>
							))}
						</div>
					) : null}
				</div>

				<div className="store-pdp__info">
					<p className="store-pdp__category">{item.categoria_nombre}</p>
					<h3 className="store-pdp__name">{item.nombre}</h3>

					<div className={`store-pdp__price${offer ? ' is-offer' : ''}`}>
						{offer ? <s>{formatPrecio(listPrice)}</s> : null}
						<strong>{formatPrecio(payPrice)}</strong>
						{off > 0 ? <span className="store-pdp__save">−{off}%</span> : null}
					</div>

					{groups.map((group) => (
						<div key={group.id} className="store-pdp__field">
							<p className="store-pdp__label">{group.nombre}</p>
							<div className="store-pdp__picks">
								{group.valores.map((valor) => {
									const on = picked[group.id] === valor;
									const pickStock = stockForPick(group.id, valor);
									return (
										<button
											key={valor}
											type="button"
											className={`store-pdp__pick${on ? ' is-on' : ''}${pickStock <= 0 ? ' is-out' : ''}`}
											aria-pressed={on}
											onClick={() => setPicked((current) => ({ ...current, [group.id]: valor }))}
										>
											{valor}
										</button>
									);
								})}
							</div>
						</div>
					))}

					<p className={`store-pdp__stock${available ? '' : ' is-out'}`}>
						{available ? `Hay ${formatStock(stock)}` : soldOut ? 'Producto agotado' : 'Combinación agotada'}
						{variante?.sku ? <span> · {variante.sku}</span> : null}
					</p>

					{available ? (
						<>
							<div className="store-pdp__buy">
								<div className="store-pdp__qty" role="group" aria-label="Cantidad">
									<button
										type="button"
										disabled={qty <= 1}
										aria-label="Menos"
										onClick={() => setQty((current) => Math.max(1, current - 1))}
									>
										−
									</button>
									<span>{qty}</span>
									<button
										type="button"
										disabled={qty >= stock}
										aria-label="Más"
										onClick={() => setQty((current) => Math.min(stock, current + 1))}
									>
										+
									</button>
								</div>
								<button type="button" className="store-pdp__cta" disabled tabIndex={-1}>
									<IconWhatsApp />
									Pedir por WhatsApp
								</button>
							</div>
							<p className="store-pdp__hint">Así pedirá el cliente. En el admin no se envía nada.</p>
						</>
					) : (
						<div className="store-pdp__sold-box">
							<p className="store-pdp__sold-title">{soldOut ? 'Agotado' : 'Sin stock en esta opción'}</p>
							<p className="store-pdp__hint">
								{soldOut
									? 'El cliente no puede pedirlo hasta que haya unidades.'
									: 'Puede elegir otra talla o color si hay stock.'}
							</p>
						</div>
					)}

					{item.descripcion ? (
						<div className="store-pdp__block">
							<p className="store-pdp__label">Descripción</p>
							<p className="store-pdp__copy">{item.descripcion}</p>
						</div>
					) : null}

					{extras.length > 0 ? (
						<dl className="store-pdp__specs">
							{extras.map((row) => (
								<div key={row.nombre} className="store-pdp__spec">
									<dt>{row.nombre}</dt>
									<dd>{row.valor}</dd>
								</div>
							))}
						</dl>
					) : null}
				</div>
			</div>
		</div>
	);
}
