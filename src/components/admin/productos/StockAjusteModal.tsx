import { useEffect, useState } from 'react';
import type { ProductoListado, ProductoVariante } from '@/lib/productos/shared';
import { IconMinusCircle, IconPlusCircle } from '../crud/icons';

type Props = {
	producto: ProductoListado;
	modo: 'entrada' | 'salida';
	onClose: () => void;
	onSuccess: (updated: ProductoListado) => void;
};

export default function StockAjusteModal({ producto, modo, onClose, onSuccess }: Props) {
	const isEntrada = modo === 'entrada';
	const [variantes, setVariantes] = useState<ProductoVariante[]>([]);
	const [varianteId, setVarianteId] = useState<string>('');
	const [cantidad, setCantidad] = useState<number>(1);
	const [motivo, setMotivo] = useState<string>('');
	const [loadingVariantes, setLoadingVariantes] = useState<boolean>(true);
	const [submitting, setSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		let isMounted = true;
		async function fetchProducto() {
			try {
				const res = await fetch(`/api/admin/productos/${producto.id}`);
				const data = (await res.json()) as { item?: { variantes?: ProductoVariante[] }; error?: string };
				if (isMounted && data.item && Array.isArray(data.item.variantes)) {
					setVariantes(data.item.variantes);
					if (data.item.variantes.length > 0) {
						setVarianteId(data.item.variantes[0].id);
					}
				}
			} catch (e) {
				console.error('Error fetching variantes:', e);
			} finally {
				if (isMounted) setLoadingVariantes(false);
			}
		}
		fetchProducto();
		return () => {
			isMounted = false;
		};
	}, [producto.id]);

	const selectedVariante = variantes.find((v) => v.id === varianteId) || variantes[0];
	const stockActual = selectedVariante ? selectedVariante.stock : producto.stock_total;
	const stockResultante = isEntrada ? stockActual + (cantidad || 0) : Math.max(0, stockActual - (cantidad || 0));

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError('');

		const cantNum = Math.round(Number(cantidad) || 0);
		if (cantNum <= 0) {
			setError('La cantidad debe ser de al menos 1 unidad.');
			return;
		}

		if (!isEntrada && cantNum > stockActual) {
			setError(`No puedes restar más del stock actual (${stockActual} uds.).`);
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch(`/api/admin/productos/${producto.id}/stock`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify({
					tipo: modo,
					cantidad: cantNum,
					varianteId: varianteId || undefined,
					motivo: motivo.trim() || undefined,
				}),
			});

			const data = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				item?: ProductoListado;
				error?: string;
			};

			if (!res.ok || !data.item) {
				setError(data.error || 'No se pudo actualizar el stock.');
				setSubmitting(false);
				return;
			}

			onSuccess(data.item);
		} catch (err) {
			console.error(err);
			setError('Error de conexión al guardar el movimiento.');
			setSubmitting(false);
		}
	}

	return (
		<form className="admin-form stock-modal-form" onSubmit={handleSubmit}>
			{error ? (
				<div className="admin-form__alert is-visible" role="alert">
					{error}
				</div>
			) : null}

			<div className="stock-modal-product-summary">
				<div className="stock-modal-product-name">
					<strong>{producto.nombre}</strong>
				</div>
				<div className="stock-modal-badge-row">
					<span className={`stock-badge ${isEntrada ? 'stock-badge--entrada' : 'stock-badge--salida'}`}>
						{isEntrada ? <IconPlusCircle /> : <IconMinusCircle />}
						{isEntrada ? 'Agregar / Reponer Stock' : 'Restar / Descontar Stock'}
					</span>
				</div>
			</div>

			{loadingVariantes ? (
				<p className="admin-form__help">Cargando variantes...</p>
			) : variantes.length > 1 ? (
				<label className="admin-form__field">
					<span>Variante / Combinación</span>
					<select
						className="admin-form__input admin-form__select"
						value={varianteId}
						onChange={(e) => setVarianteId(e.target.value)}
						disabled={submitting}
					>
						{variantes.map((v) => (
							<option key={v.id} value={v.id}>
								{v.combinacion} — Stock actual: {v.stock} uds. (SKU: {v.sku})
							</option>
						))}
					</select>
				</label>
			) : selectedVariante ? (
				<div className="stock-modal-single-variant">
					<span className="stock-modal-single-label">Variante:</span>
					<strong>
						{selectedVariante.combinacion !== 'Único' ? selectedVariante.combinacion : 'Única / Estándar'}
					</strong>
					<span className="stock-modal-sku-tag">SKU: {selectedVariante.sku || 'N/A'}</span>
				</div>
			) : null}

			{/* Comparador de Stock con diseño unificado */}
			<div className="stock-adjust-visual">
				<div className="stock-adjust-stat">
					<span className="stock-adjust-stat__label">Stock actual</span>
					<span className="stock-adjust-stat__val">{stockActual}</span>
					<span className="stock-adjust-stat__sub">uds. disponibles</span>
				</div>

				<div className="stock-adjust-stat__symbol">
					{isEntrada ? '+' : '−'}
				</div>

				<div className="stock-adjust-input-box">
					<span className="stock-adjust-stat__label">
						{isEntrada ? 'Cantidad a agregar' : 'Cantidad a restar'}
					</span>
					<div className="stock-stepper">
						<button
							type="button"
							className="stock-stepper__btn"
							onClick={() => setCantidad((prev) => Math.max(1, (prev || 1) - 1))}
							disabled={submitting || cantidad <= 1}
							title="Restar 1"
						>
							−
						</button>
						<input
							type="number"
							min="1"
							max={!isEntrada ? stockActual : 999999}
							value={cantidad}
							onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
							className="admin-form__input stock-stepper__input"
							required
							disabled={submitting}
							autoFocus
						/>
						<button
							type="button"
							className="stock-stepper__btn"
							onClick={() =>
								setCantidad((prev) => (!isEntrada ? Math.min(stockActual, (prev || 0) + 1) : (prev || 0) + 1))
							}
							disabled={submitting || (!isEntrada && cantidad >= stockActual)}
							title="Sumar 1"
						>
							+
						</button>
					</div>
					<span className="stock-adjust-stat__sub">unidades</span>
				</div>

				<div className="stock-adjust-stat__symbol">=</div>

				<div className="stock-adjust-stat stock-adjust-stat--result">
					<span className="stock-adjust-stat__label">Stock resultante</span>
					<span className={`stock-adjust-stat__val ${stockResultante === 0 ? 'is-danger' : ''}`}>
						{stockResultante}
					</span>
					<span className="stock-adjust-stat__sub">
						{stockResultante === 0 ? 'Quedará agotado' : 'uds. tras guardar'}
					</span>
				</div>
			</div>

			<label className="admin-form__field">
				<span>
					Motivo o referencia <small style={{ fontWeight: 'normal', opacity: 0.65 }}>(opcional)</small>
				</span>
				<input
					type="text"
					className="admin-form__input"
					placeholder={
						isEntrada
							? 'Ej: Compra de lote a proveedor, corrección de inventario...'
							: 'Ej: Merma, daño físico, retiro para exhibición...'
					}
					value={motivo}
					onChange={(e) => setMotivo(e.target.value)}
					disabled={submitting}
					maxLength={160}
				/>
			</label>

			<div className="admin-form__actions stock-modal-actions">
				<button
					type="button"
					className="admin-btn admin-btn--ghost"
					onClick={onClose}
					disabled={submitting}
				>
					Cancelar
				</button>
				<button
					type="submit"
					className={`admin-btn ${isEntrada ? 'admin-btn--success' : 'admin-btn--danger'}`}
					disabled={submitting || (!isEntrada && stockActual === 0)}
				>
					{submitting ? 'Guardando...' : isEntrada ? 'Confirmar Reposición' : 'Confirmar Descuento'}
				</button>
			</div>
		</form>
	);
}
