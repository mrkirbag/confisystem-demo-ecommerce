export type EstadoPedido = 'pendiente' | 'confirmada' | 'cancelada';
export type ModalidadEntrega = 'delivery' | 'pickup';

export type PedidoItem = {
	id: string;
	venta_id: string;
	producto_id: string;
	variante_id: string | null;
	nombre_producto: string;
	combinacion: string | null;
	cantidad: number;
	precio_unitario: number;
	subtotal: number;
	imagen_url?: string | null;
};

export type Pedido = {
	id: string;
	codigo: string;
	cliente_nombre: string;
	cliente_cedula: string;
	cliente_telefono: string;
	nota: string | null;
	estado: EstadoPedido;
	subtotal: number;
	monto_envio: number;
	total: number;
	modalidad_entrega: ModalidadEntrega;
	direccion_envio: string | null;
	metodo_pago: string | null;
	creado_en: string;
	actualizado_en: string;
	confirmado_por: string | null;
	confirmado_por_nombre?: string | null;
	items: PedidoItem[];
};

export type PedidoListado = {
	id: string;
	codigo: string;
	cliente_nombre: string;
	cliente_cedula: string;
	cliente_telefono: string;
	estado: EstadoPedido;
	subtotal: number;
	monto_envio: number;
	total: number;
	modalidad_entrega: ModalidadEntrega;
	metodo_pago: string | null;
	creado_en: string;
	total_items: number;
	total_unidades: number;
	items_resumen: string;
	primeras_imagenes: string[];
};

export type ProductoRanking = {
	id: string;
	nombre: string;
	imagen_url: string | null;
	unidades_vendidas: number;
	monto_total: number;
	stock_actual: number;
};

export type ProductoStockAlerta = {
	id: string;
	producto_id: string;
	nombre: string;
	combinacion: string;
	sku: string;
	stock: number;
	precio: number;
	imagen_url: string | null;
	estado: 'agotado' | 'baja_existencia';
};

export type FlujoVentasPunto = {
	fecha: string;
	label: string;
	monto: number;
	cantidad: number;
};

export type EstadisticasVentas = {
	totalConfirmadas: number;
	montoConfirmadas: number;
	totalCanceladas: number;
	montoCanceladas: number;
	totalPendientes: number;
	montoPendientes: number;
	ticketPromedio: number;
	tasaEfectividad: number;
	ultimasConfirmadas: PedidoListado[];
	ultimasPendientes: PedidoListado[];
	ultimasCanceladas: PedidoListado[];
	masVendidos: ProductoRanking[];
	menosVendidos: ProductoRanking[];
	bajaExistencia: ProductoStockAlerta[];
	agotados: ProductoStockAlerta[];
	flujoAprobadas: FlujoVentasPunto[];
};

export function formatPrecio(val: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Number(val) || 0);
}

export function formatFechaCorta(fechaStr: string): string {
	if (!fechaStr) return '';
	try {
		// SQLite CURRENT_TIMESTAMP is UTC: 'YYYY-MM-DD HH:MM:SS'
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

export function estadoBadgeInfo(estado: EstadoPedido): {
	label: string;
	className: string;
	color: string;
	bg: string;
} {
	switch (estado) {
		case 'pendiente':
			return {
				label: 'Pendiente',
				className: 'is-warning',
				color: '#d97706',
				bg: 'rgba(217, 119, 6, 0.12)',
			};
		case 'confirmada':
			return {
				label: 'Aprobada / Confirmada',
				className: 'is-success',
				color: '#16a34a',
				bg: 'rgba(22, 163, 74, 0.12)',
			};
		case 'cancelada':
			return {
				label: 'Cancelada',
				className: 'is-danger',
				color: '#dc2626',
				bg: 'rgba(220, 38, 38, 0.12)',
			};
		default:
			return {
				label: estado,
				className: 'is-neutral',
				color: '#6b7280',
				bg: 'rgba(107, 114, 128, 0.12)',
			};
	}
}
