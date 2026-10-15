import { useEffect, useState } from 'react';
import type { ProductoListado, ProductoMovimientoStock } from '@/lib/productos/shared';
import { IconHistory, IconSearch } from '../crud/icons';

type Props = {
	producto: ProductoListado;
	onClose: () => void;
};

function formatFechaCompleta(fechaStr: string) {
	if (!fechaStr) return '—';
	try {
		const iso = fechaStr.includes('T') ? fechaStr : fechaStr.replace(' ', 'T') + 'Z';
		const date = new Date(iso);
		if (isNaN(date.getTime())) return fechaStr;

		return new Intl.DateTimeFormat('es-VE', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
		}).format(date);
	} catch {
		return fechaStr;
	}
}

export default function StockHistorialModal({ producto, onClose }: Props) {
	const [movimientos, setMovimientos] = useState<ProductoMovimientoStock[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string>('');

	// Filtros
	const [desde, setDesde] = useState<string>('');
	const [hasta, setHasta] = useState<string>('');
	const [tipoFiltro, setTipoFiltro] = useState<string>('');
	const [busqueda, setBusqueda] = useState<string>('');

	useEffect(() => {
		let isMounted = true;
		async function fetchHistorial() {
			setLoading(true);
			setError('');
			try {
				const params = new URLSearchParams();
				if (desde) params.set('desde', desde);
				if (hasta) params.set('hasta', hasta);
				if (tipoFiltro) params.set('tipo', tipoFiltro);

				const res = await fetch(`/api/admin/productos/${producto.id}/movimientos?${params.toString()}`);
				const data = (await res.json()) as { ok?: boolean; movimientos?: ProductoMovimientoStock[]; error?: string };
				if (isMounted) {
					if (!res.ok) {
						setError(data.error || 'No se pudo cargar el historial.');
					} else {
						setMovimientos(data.movimientos || []);
					}
				}
			} catch (err) {
				console.error(err);
				if (isMounted) setError('Error al conectar con el servidor.');
			} finally {
				if (isMounted) setLoading(false);
			}
		}

		fetchHistorial();
		return () => {
			isMounted = false;
		};
	}, [producto.id, desde, hasta, tipoFiltro]);

	const filtrados = movimientos.filter((m) => {
		if (!busqueda.trim()) return true;
		const q = busqueda.toLowerCase().trim();
		const combo = (m.variante_combinacion || '').toLowerCase();
		const sku = (m.variante_sku || '').toLowerCase();
		const motivo = (m.motivo || '').toLowerCase();
		const usuario = (m.usuario_nombre || '').toLowerCase();
		return combo.includes(q) || sku.includes(q) || motivo.includes(q) || usuario.includes(q);
	});

	function badgePorTipo(tipo: string) {
		switch (tipo) {
			case 'entrada':
				return {
					label: 'Reposición (+)',
					className: 'stock-badge stock-badge--entrada',
				};
			case 'salida':
				return {
					label: 'Descuento (−)',
					className: 'stock-badge stock-badge--salida',
				};
			case 'venta':
				return {
					label: 'Venta / Reserva (−)',
					className: 'stock-badge stock-badge--venta',
				};
			case 'devolucion':
				return {
					label: 'Devolución / Reposición (+)',
					className: 'stock-badge stock-badge--devolucion',
				};
			case 'ajuste':
			default:
				return {
					label: 'Ajuste',
					className: 'stock-badge stock-badge--ajuste',
				};
		}
	}

	return (
		<div className="stock-historial-modal">
			<div className="stock-modal-product-summary">
				<div className="stock-modal-product-name">
					<strong>{producto.nombre}</strong>
				</div>
				<div className="stock-modal-badge-row">
					<span className="stock-modal-stock-current">
						Stock actual total: <strong>{producto.stock_total} uds.</strong>
					</span>
				</div>
			</div>

			{/* Barra de Filtros */}
			<div className="stock-historial-filters">
				<div className="stock-filter-group">
					<label className="stock-filter-field">
						<span>Desde</span>
						<input
							type="date"
							className="admin-form__input stock-date-input"
							value={desde}
							onChange={(e) => setDesde(e.target.value)}
						/>
					</label>
					<label className="stock-filter-field">
						<span>Hasta</span>
						<input
							type="date"
							className="admin-form__input stock-date-input"
							value={hasta}
							onChange={(e) => setHasta(e.target.value)}
						/>
					</label>
					{(desde || hasta) && (
						<button
							type="button"
							className="admin-btn admin-btn--ghost admin-btn--sm"
							onClick={() => {
								setDesde('');
								setHasta('');
							}}
							title="Limpiar fechas"
						>
							Limpiar
						</button>
					)}
				</div>

				<div className="stock-filter-group stock-filter-group--right">
					<select
						className="admin-form__input admin-form__select stock-select-tipo"
						value={tipoFiltro}
						onChange={(e) => setTipoFiltro(e.target.value)}
					>
						<option value="">Todos los tipos</option>
						<option value="entrada">Reposición manual (+)</option>
						<option value="salida">Descuento manual (−)</option>
						<option value="venta">Venta / Descuento (−)</option>
						<option value="devolucion">Devolución / Cancelación (+)</option>
						<option value="ajuste">Ajustes</option>
					</select>

					<div className="stock-search-wrap">
						<IconSearch className="stock-search-icon" />
						<input
							type="search"
							placeholder="Buscar motivo, SKU..."
							className="admin-form__input stock-search-input"
							value={busqueda}
							onChange={(e) => setBusqueda(e.target.value)}
						/>
					</div>
				</div>
			</div>

			{error ? (
				<div className="admin-form__alert is-visible" role="alert">
					{error}
				</div>
			) : null}

			{/* Listado / Tabla */}
			{loading ? (
				<div className="stock-historial-loading">
					<div className="stock-spinner" />
					<p>Cargando movimientos de inventario...</p>
				</div>
			) : filtrados.length === 0 ? (
				<div className="admin-empty" style={{ margin: '1.5rem 0' }}>
					<div style={{ opacity: 0.4, margin: '0 auto 0.5rem', display: 'flex', justifyContent: 'center' }}>
						<IconHistory />
					</div>
					<p className="admin-empty__title">Sin movimientos registrados</p>
					<p className="admin-empty__text">
						{desde || hasta || tipoFiltro || busqueda
							? 'No hay registros que coincidan con los filtros aplicados.'
							: 'Aún no se han registrado descuentos o reposiciones para este producto.'}
					</p>
				</div>
			) : (
				<div className="stock-historial-table-wrap">
					<table className="admin-table stock-historial-table">
						<thead>
							<tr>
								<th>Fecha y hora</th>
								<th>Tipo</th>
								<th>Variante / SKU</th>
								<th style={{ textAlign: 'center' }}>Cantidad</th>
								<th style={{ textAlign: 'center' }}>Antes → Después</th>
								<th>Motivo / Referencia</th>
								<th>Responsable</th>
							</tr>
						</thead>
						<tbody>
							{filtrados.map((m) => {
								const badge = badgePorTipo(m.tipo);
								const esSuma = m.tipo === 'entrada' || m.tipo === 'devolucion';
								return (
									<tr key={m.id}>
										<td className="stock-td-date">
											<strong>{formatFechaCompleta(m.fecha_registro)}</strong>
										</td>
										<td>
											<span className={badge.className}>{badge.label}</span>
										</td>
										<td className="stock-td-variant">
											<div className="stock-td-variant-inner">
												<strong>{m.variante_combinacion || 'Único'}</strong>
												{m.variante_sku ? <span className="stock-sku-badge">{m.variante_sku}</span> : null}
											</div>
										</td>
										<td style={{ textAlign: 'center' }}>
											<span className={`stock-diff-num ${esSuma ? 'is-plus' : 'is-minus'}`}>
												{esSuma ? `+${m.cantidad}` : `−${m.cantidad}`}
											</span>
										</td>
										<td style={{ textAlign: 'center' }}>
											<span className="stock-flow-nums">
												<span>{m.stock_anterior}</span>
												<span className="stock-flow-arrow">→</span>
												<strong className={m.stock_nuevo === 0 ? 'stock-zero-alert' : ''}>{m.stock_nuevo}</strong>
											</span>
										</td>
										<td className="stock-td-motivo">{m.motivo || '—'}</td>
										<td className="stock-td-user">{m.usuario_nombre || 'Sistema'}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<div className="admin-form__actions stock-modal-actions">
				<div className="stock-historial-count">
					Mostrando <strong>{filtrados.length}</strong> {filtrados.length === 1 ? 'movimiento' : 'movimientos'}
				</div>
				<button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
					Cerrar
				</button>
			</div>
		</div>
	);
}
