import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index';
import { registrarAuditoria, type ActorAuditoria } from '../auditoria/index';
import { registrarMovimientoStock } from '../productos/index';
import type {
	EstadoPedido,
	EstadisticasVentas,
	FlujoVentasPunto,
	ModalidadEntrega,
	Pedido,
	PedidoItem,
	PedidoListado,
	ProductoRanking,
	ProductoStockAlerta,
} from './shared';

export * from './shared';

let schemaChecked = false;

export async function ensurePedidosSchema() {
	if (schemaChecked) return;
	const db = getDb();

	async function hasCol(table: string, col: string): Promise<boolean> {
		try {
			const res = await db.execute(`PRAGMA table_info(${table})`);
			return res.rows.some((r) => String((r as Record<string, unknown>).name ?? '') === col);
		} catch {
			return false;
		}
	}

	async function addCol(sql: string) {
		try {
			await db.execute(sql);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!/duplicate column/i.test(msg)) console.warn('Aviso agregando columna:', msg);
		}
	}

	if (!(await hasCol('ventas', 'monto_envio'))) {
		await addCol(`ALTER TABLE ventas ADD COLUMN monto_envio REAL DEFAULT 0`);
	}
	if (!(await hasCol('ventas', 'subtotal'))) {
		await addCol(`ALTER TABLE ventas ADD COLUMN subtotal REAL DEFAULT 0`);
	}
	if (!(await hasCol('ventas', 'modalidad_entrega'))) {
		await addCol(`ALTER TABLE ventas ADD COLUMN modalidad_entrega TEXT DEFAULT 'delivery'`);
	}
	if (!(await hasCol('ventas', 'direccion_envio'))) {
		await addCol(`ALTER TABLE ventas ADD COLUMN direccion_envio TEXT DEFAULT ''`);
	}
	if (!(await hasCol('ventas', 'metodo_pago'))) {
		await addCol(`ALTER TABLE ventas ADD COLUMN metodo_pago TEXT DEFAULT ''`);
	}
	if (!(await hasCol('venta_items', 'imagen_url'))) {
		await addCol(`ALTER TABLE venta_items ADD COLUMN imagen_url TEXT`);
	}

	schemaChecked = true;
}

export type CrearPedidoItemInput = {
	productId: string;
	varianteId?: string | null;
	combinacion?: string | null;
	nombre: string;
	precio: number;
	cantidad: number;
	imagenUrl?: string | null;
};

export type CrearPedidoInput = {
	cliente_nombre: string;
	cliente_cedula?: string;
	cliente_telefono: string;
	modalidad_entrega: ModalidadEntrega;
	direccion_envio?: string;
	metodo_pago?: string;
	nota?: string;
	items: CrearPedidoItemInput[];
};

export async function generarSiguienteCodigoPedido(): Promise<string> {
	await ensurePedidosSchema();
	const db = getDb();

	const res = await db.execute(`
		SELECT codigo FROM ventas
		WHERE codigo LIKE 'PED-%'
		ORDER BY creado_en DESC, codigo DESC
		LIMIT 10
	`);

	let maxNum = 0;
	for (const row of res.rows) {
		const cod = String((row as Record<string, unknown>).codigo || '');
		const match = cod.match(/PED-(\d+)/);
		if (match) {
			const n = parseInt(match[1], 10);
			if (n > maxNum) maxNum = n;
		}
	}

	const nextNum = maxNum + 1;
	return `PED-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Crea un pedido en estado 'pendiente' y bloquea/descuenta el stock preventivamente
 */
export async function crearPedido(input: CrearPedidoInput): Promise<{ ok: boolean; pedidoId: string; codigo: string }> {
	await ensurePedidosSchema();
	const db = getDb();

	if (!input.cliente_nombre.trim()) {
		throw new Error('El nombre del cliente es obligatorio');
	}
	if (!input.cliente_telefono.trim()) {
		throw new Error('El teléfono del cliente es obligatorio');
	}
	if (!input.items || input.items.length === 0) {
		throw new Error('El carrito no contiene productos');
	}

	const ventaId = randomUUID();
	const codigo = await generarSiguienteCodigoPedido();
	const subtotal = input.items.reduce((acc, it) => acc + (Number(it.precio) || 0) * (Number(it.cantidad) || 1), 0);
	const montoEnvio = 0; // Al inicio es 0 o a convenir
	const total = subtotal + montoEnvio;

	// 1. Preparar ítems y resolver IDs de variantes
	const itemsProcesados: {
		id: string;
		productoId: string;
		varianteId: string | null;
		nombre: string;
		combinacion: string;
		cantidad: number;
		precioUnitario: number;
		subtotal: number;
		imagenUrl: string | null;
	}[] = [];

	for (const item of input.items) {
		const cant = Math.max(1, Math.round(Number(item.cantidad) || 1));
		const pUnit = Math.max(0, Number(item.precio) || 0);
		const pSub = pUnit * cant;

		let prodId = item.productId;
		let varId = item.varianteId || null;

		// Si productId es un slug, buscar el ID real
		const prodQuery = await db.execute({
			sql: `SELECT id, nombre FROM productos WHERE id = ? OR slug = ? LIMIT 1`,
			args: [prodId, prodId],
		});

		if (prodQuery.rows.length > 0) {
			prodId = String((prodQuery.rows[0] as Record<string, unknown>).id);
		}

		// Si no hay varianteId o es inválida, buscar en producto_stock_variantes
		if (!varId && prodId) {
			const combo = item.combinacion?.trim() || '';
			const varQuery = combo
				? await db.execute({
						sql: `SELECT id FROM producto_stock_variantes WHERE producto_id = ? AND (combinacion = ? OR combinacion = 'Único') LIMIT 1`,
						args: [prodId, combo],
					})
				: await db.execute({
						sql: `SELECT id FROM producto_stock_variantes WHERE producto_id = ? LIMIT 1`,
						args: [prodId],
					});

			if (varQuery.rows.length > 0) {
				varId = String((varQuery.rows[0] as Record<string, unknown>).id);
			}
		}

		itemsProcesados.push({
			id: randomUUID(),
			productoId: prodId,
			varianteId: varId,
			nombre: item.nombre,
			combinacion: item.combinacion || 'Única',
			cantidad: cant,
			precioUnitario: pUnit,
			subtotal: pSub,
			imagenUrl: item.imagenUrl || null,
		});
	}

	// 2. Bloqueo preventivo del stock en la BD
	for (const it of itemsProcesados) {
		const varId = it.varianteId || (await (async () => {
			if (!it.productoId) return null;
			const r = await db.execute({
				sql: `SELECT id FROM producto_stock_variantes WHERE producto_id = ? LIMIT 1`,
				args: [it.productoId],
			});
			return r.rows[0] ? String((r.rows[0] as Record<string, unknown>).id) : null;
		})());

		if (varId) {
			const curRes = await db.execute({
				sql: `SELECT stock FROM producto_stock_variantes WHERE id = ?`,
				args: [varId],
			});
			const stockAnt = curRes.rows[0] ? Number((curRes.rows[0] as Record<string, unknown>).stock ?? 0) : 0;
			const stockNvo = Math.max(0, stockAnt - it.cantidad);

			await db.execute({
				sql: `UPDATE producto_stock_variantes SET stock = ? WHERE id = ?`,
				args: [stockNvo, varId],
			});

			if (it.productoId) {
				await registrarMovimientoStock({
					productoId: it.productoId,
					varianteId: varId,
					tipo: 'venta',
					cantidad: it.cantidad,
					stockAnterior: stockAnt,
					stockNuevo: stockNvo,
					motivo: `Venta web #${codigo} - Reserva inicial`,
					usuarioId: null,
				});
			}
		}
	}

	// 3. Insertar venta principal
	await db.execute({
		sql: `
			INSERT INTO ventas (
				id, codigo, cliente_nombre, cliente_cedula, cliente_telefono,
				nota, estado, subtotal, monto_envio, total,
				modalidad_entrega, direccion_envio, metodo_pago,
				creado_en, actualizado_en
			) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`,
		args: [
			ventaId,
			codigo,
			input.cliente_nombre.trim(),
			(input.cliente_cedula || '').trim(),
			input.cliente_telefono.trim(),
			input.nota?.trim() || null,
			subtotal,
			montoEnvio,
			total,
			input.modalidad_entrega || 'delivery',
			input.direccion_envio?.trim() || '',
			input.metodo_pago?.trim() || '',
		],
	});

	// 4. Insertar ítems
	for (const it of itemsProcesados) {
		await db.execute({
			sql: `
				INSERT INTO venta_items (
					id, venta_id, producto_id, variante_id, nombre_producto,
					combinacion, cantidad, precio_unitario, subtotal, imagen_url
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
			args: [
				it.id,
				ventaId,
				it.productoId,
				it.varianteId,
				it.nombre,
				it.combinacion,
				it.cantidad,
				it.precioUnitario,
				it.subtotal,
				it.imagenUrl,
			],
		});
	}

	// 5. Auditoría
	await registrarAuditoria({
		usuarioId: 'cliente_web',
		entidad: 'ventas',
		entidadId: ventaId,
		accion: 'crear',
		cambios: {
			codigo,
			cliente: input.cliente_nombre,
			total,
			itemsCount: itemsProcesados.length,
			nota: 'Pedido creado desde catálogo web con reserva preventiva de stock',
		},
	});

	return { ok: true, pedidoId: ventaId, codigo };
}

/**
 * Lista pedidos para el panel administrativo con filtros
 */
export async function listPedidos(filtros?: {
	estado?: EstadoPedido | 'todos';
	busqueda?: string;
}): Promise<PedidoListado[]> {
	await ensurePedidosSchema();
	const db = getDb();

	let whereClauses: string[] = [];
	const args: (string | number | null)[] = [];

	if (filtros?.estado && filtros.estado !== 'todos') {
		whereClauses.push(`v.estado = ?`);
		args.push(filtros.estado);
	}

	if (filtros?.busqueda && filtros.busqueda.trim()) {
		const q = `%${filtros.busqueda.trim()}%`;
		whereClauses.push(`(v.codigo LIKE ? OR v.cliente_nombre LIKE ? OR v.cliente_telefono LIKE ? OR v.cliente_cedula LIKE ?)`);
		args.push(q, q, q, q);
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

	const sql = `
		SELECT
			v.id,
			v.codigo,
			v.cliente_nombre,
			v.cliente_cedula,
			v.cliente_telefono,
			v.estado,
			COALESCE(v.subtotal, v.total) AS subtotal,
			COALESCE(v.monto_envio, 0) AS monto_envio,
			v.total,
			COALESCE(v.modalidad_entrega, 'delivery') AS modalidad_entrega,
			COALESCE(v.metodo_pago, '') AS metodo_pago,
			v.creado_en,
			(SELECT COUNT(*) FROM venta_items WHERE venta_id = v.id) AS total_items,
			(SELECT COALESCE(SUM(cantidad), 0) FROM venta_items WHERE venta_id = v.id) AS total_unidades,
			(
				SELECT GROUP_CONCAT(nombre_producto || ' (x' || cantidad || ')', ', ')
				FROM (SELECT nombre_producto, cantidad FROM venta_items WHERE venta_id = v.id LIMIT 3)
			) AS items_resumen,
			(
				SELECT GROUP_CONCAT(COALESCE(imagen_url, ''), '|||')
				FROM (SELECT imagen_url FROM venta_items WHERE venta_id = v.id AND imagen_url IS NOT NULL AND imagen_url != '' LIMIT 3)
			) AS imagenes_raw
		FROM ventas v
		${whereSql}
		ORDER BY v.creado_en DESC
	`;

	const res = await db.execute({ sql, args });

	return res.rows.map((raw) => {
		const r = raw as Record<string, unknown>;
		const imgRaw = String(r.imagenes_raw || '');
		const imagenes = imgRaw ? imgRaw.split('|||').filter(Boolean) : [];

		return {
			id: String(r.id),
			codigo: String(r.codigo),
			cliente_nombre: String(r.cliente_nombre || ''),
			cliente_cedula: String(r.cliente_cedula || ''),
			cliente_telefono: String(r.cliente_telefono || ''),
			estado: (r.estado as EstadoPedido) || 'pendiente',
			subtotal: Number(r.subtotal ?? 0),
			monto_envio: Number(r.monto_envio ?? 0),
			total: Number(r.total ?? 0),
			modalidad_entrega: (r.modalidad_entrega as ModalidadEntrega) || 'delivery',
			metodo_pago: String(r.metodo_pago || ''),
			creado_en: String(r.creado_en || ''),
			total_items: Number(r.total_items ?? 0),
			total_unidades: Number(r.total_unidades ?? 0),
			items_resumen: String(r.items_resumen || ''),
			primeras_imagenes: imagenes,
		};
	});
}

/**
 * Obtiene un pedido completo por su ID con todos sus ítems
 */
export async function getPedidoById(id: string): Promise<Pedido | null> {
	await ensurePedidosSchema();
	const db = getDb();

	const res = await db.execute({
		sql: `
			SELECT
				v.id,
				v.codigo,
				v.cliente_nombre,
				v.cliente_cedula,
				v.cliente_telefono,
				v.nota,
				v.estado,
				COALESCE(v.subtotal, v.total) AS subtotal,
				COALESCE(v.monto_envio, 0) AS monto_envio,
				v.total,
				COALESCE(v.modalidad_entrega, 'delivery') AS modalidad_entrega,
				v.direccion_envio,
				v.metodo_pago,
				v.creado_en,
				v.actualizado_en,
				v.confirmado_por,
				u.nombre AS confirmado_por_nombre
			FROM ventas v
			LEFT JOIN usuarios_admin u ON u.id = v.confirmado_por
			WHERE v.id = ?
			LIMIT 1
		`,
		args: [id],
	});

	if (res.rows.length === 0) return null;
	const r = res.rows[0] as Record<string, unknown>;

	const itemsRes = await db.execute({
		sql: `
			SELECT
				vi.id,
				vi.venta_id,
				vi.producto_id,
				vi.variante_id,
				vi.nombre_producto,
				vi.combinacion,
				vi.cantidad,
				vi.precio_unitario,
				vi.subtotal,
				COALESCE(
					vi.imagen_url,
					(SELECT url FROM productos_imagenes WHERE producto_id = vi.producto_id ORDER BY orden ASC LIMIT 1)
				) AS imagen_url
			FROM venta_items vi
			WHERE vi.venta_id = ?
			ORDER BY vi.rowid ASC
		`,
		args: [id],
	});

	const items: PedidoItem[] = itemsRes.rows.map((row) => {
		const itemRow = row as Record<string, unknown>;
		return {
			id: String(itemRow.id),
			venta_id: String(itemRow.venta_id),
			producto_id: String(itemRow.producto_id),
			variante_id: itemRow.variante_id ? String(itemRow.variante_id) : null,
			nombre_producto: String(itemRow.nombre_producto || ''),
			combinacion: itemRow.combinacion ? String(itemRow.combinacion) : null,
			cantidad: Number(itemRow.cantidad ?? 1),
			precio_unitario: Number(itemRow.precio_unitario ?? 0),
			subtotal: Number(itemRow.subtotal ?? 0),
			imagen_url: itemRow.imagen_url ? String(itemRow.imagen_url) : null,
		};
	});

	return {
		id: String(r.id),
		codigo: String(r.codigo),
		cliente_nombre: String(r.cliente_nombre || ''),
		cliente_cedula: String(r.cliente_cedula || ''),
		cliente_telefono: String(r.cliente_telefono || ''),
		nota: r.nota ? String(r.nota) : null,
		estado: (r.estado as EstadoPedido) || 'pendiente',
		subtotal: Number(r.subtotal ?? 0),
		monto_envio: Number(r.monto_envio ?? 0),
		total: Number(r.total ?? 0),
		modalidad_entrega: (r.modalidad_entrega as ModalidadEntrega) || 'delivery',
		direccion_envio: r.direccion_envio ? String(r.direccion_envio) : null,
		metodo_pago: r.metodo_pago ? String(r.metodo_pago) : null,
		creado_en: String(r.creado_en || ''),
		actualizado_en: String(r.actualizado_en || ''),
		confirmado_por: r.confirmado_por ? String(r.confirmado_por) : null,
		confirmado_por_nombre: r.confirmado_por_nombre ? String(r.confirmado_por_nombre) : null,
		items,
	};
}

export type ModificarPedidoInput = {
	monto_envio?: number;
	nota?: string;
	items: {
		id?: string;
		producto_id: string;
		variante_id?: string | null;
		nombre_producto: string;
		combinacion?: string | null;
		cantidad: number;
		precio_unitario: number;
		imagen_url?: string | null;
	}[];
};

/**
 * Modifica los productos, precios o monto de envío de un pedido (por el administrador).
 * Si el pedido aún está en 'pendiente' o 'confirmada', ajusta el inventario de stock por las diferencias.
 */
export async function actualizarPedidoAdmin(
	pedidoId: string,
	input: ModificarPedidoInput,
	actor: ActorAuditoria,
): Promise<Pedido> {
	await ensurePedidosSchema();
	const db = getDb();

	const pedidoActual = await getPedidoById(pedidoId);
	if (!pedidoActual) {
		throw new Error('El pedido no existe');
	}
	if (pedidoActual.estado === 'cancelada') {
		throw new Error('No se puede modificar un pedido cancelado');
	}

	// 1. Calcular ajuste de stock entre los ítems anteriores y los nuevos
	// Mapear cantidades anteriores por variante_id
	const stockAnteriorPorVariante = new Map<string, number>();
	for (const oldIt of pedidoActual.items) {
		if (oldIt.variante_id) {
			const cur = stockAnteriorPorVariante.get(oldIt.variante_id) || 0;
			stockAnteriorPorVariante.set(oldIt.variante_id, cur + oldIt.cantidad);
		}
	}

	// Mapear cantidades nuevas por variante_id
	const stockNuevoPorVariante = new Map<string, number>();
	for (const newIt of input.items) {
		if (newIt.variante_id) {
			const cant = Math.max(1, Math.round(Number(newIt.cantidad) || 1));
			const cur = stockNuevoPorVariante.get(newIt.variante_id) || 0;
			stockNuevoPorVariante.set(newIt.variante_id, cur + cant);
		}
	}

	// Ajustar en BD: si nuevo > anterior, se descuenta la diferencia; si nuevo < anterior, se devuelve
	const todasLasVariantes = new Set([...stockAnteriorPorVariante.keys(), ...stockNuevoPorVariante.keys()]);

	// 1.1 Verificar primero que todas las variantes tengan suficiente stock disponible si aumentan unidades
	for (const varId of todasLasVariantes) {
		const ant = stockAnteriorPorVariante.get(varId) || 0;
		const nva = stockNuevoPorVariante.get(varId) || 0;
		const dif = nva - ant;
		if (dif > 0) {
			const curRes = await db.execute({
				sql: `SELECT p.nombre, v.combinacion, v.stock FROM producto_stock_variantes v LEFT JOIN productos p ON p.id = v.producto_id WHERE v.id = ?`,
				args: [varId],
			});
			const row = curRes.rows[0] as Record<string, unknown> | undefined;
			const stockActual = row ? Number(row.stock ?? 0) : 0;
			const nombreProd = row?.nombre ? String(row.nombre) : 'Producto';
			const comb = row?.combinacion && row.combinacion !== 'DEFAULT' ? ` (${row.combinacion})` : '';
			if (dif > stockActual) {
				const maxTotal = ant + stockActual;
				throw new Error(
					`Stock insuficiente para ${nombreProd}${comb}. Disponible para agregar: ${stockActual} (Máximo total para este pedido: ${maxTotal}).`,
				);
			}
		}
	}

	for (const varId of todasLasVariantes) {
		const ant = stockAnteriorPorVariante.get(varId) || 0;
		const nva = stockNuevoPorVariante.get(varId) || 0;
		const dif = nva - ant;
		if (dif !== 0) {
			const curRes = await db.execute({
				sql: `SELECT producto_id, stock FROM producto_stock_variantes WHERE id = ?`,
				args: [varId],
			});
			const row = curRes.rows[0] as Record<string, unknown> | undefined;
			const stockActual = row ? Number(row.stock ?? 0) : 0;
			const prodId = row ? String(row.producto_id) : '';

			if (dif > 0) {
				// Se agregaron más unidades -> descontar stock
				const stockNuevo = Math.max(0, stockActual - dif);
				await db.execute({
					sql: `UPDATE producto_stock_variantes SET stock = ? WHERE id = ?`,
					args: [stockNuevo, varId],
				});
				if (prodId) {
					await registrarMovimientoStock({
						productoId: prodId,
						varianteId: varId,
						tipo: 'venta',
						cantidad: dif,
						stockAnterior: stockActual,
						stockNuevo,
						motivo: `Ajuste en pedido #${pedidoActual.codigo} (aumento de unidades)`,
						usuarioId: actor.id,
					});
				}
			} else if (dif < 0) {
				// Se quitaron unidades -> devolver stock
				const cantDevuelta = Math.abs(dif);
				const stockNuevo = stockActual + cantDevuelta;
				await db.execute({
					sql: `UPDATE producto_stock_variantes SET stock = ? WHERE id = ?`,
					args: [stockNuevo, varId],
				});
				if (prodId) {
					await registrarMovimientoStock({
						productoId: prodId,
						varianteId: varId,
						tipo: 'devolucion',
						cantidad: cantDevuelta,
						stockAnterior: stockActual,
						stockNuevo,
						motivo: `Ajuste en pedido #${pedidoActual.codigo} (reducción de unidades devueltas al inventario)`,
						usuarioId: actor.id,
					});
				}
			}
		}
	}

	// 2. Reemplazar los ítems de venta
	await db.execute({
		sql: `DELETE FROM venta_items WHERE venta_id = ?`,
		args: [pedidoId],
	});

	let subtotal = 0;
	for (const it of input.items) {
		const itemId = it.id && it.id.length > 5 ? it.id : randomUUID();
		const cant = Math.max(1, Math.round(Number(it.cantidad) || 1));
		const pUnit = Math.max(0, Number(it.precio_unitario) || 0);
		const pSub = pUnit * cant;
		subtotal += pSub;

		await db.execute({
			sql: `
				INSERT INTO venta_items (
					id, venta_id, producto_id, variante_id, nombre_producto,
					combinacion, cantidad, precio_unitario, subtotal, imagen_url
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
			args: [
				itemId,
				pedidoId,
				it.producto_id,
				it.variante_id || null,
				it.nombre_producto,
				it.combinacion || 'Única',
				cant,
				pUnit,
				pSub,
				it.imagen_url || null,
			],
		});
	}

	const montoEnvio = typeof input.monto_envio === 'number' ? Math.max(0, input.monto_envio) : pedidoActual.monto_envio;
	const total = subtotal + montoEnvio;
	const nota = input.nota !== undefined ? input.nota : pedidoActual.nota;

	// 3. Actualizar venta principal
	await db.execute({
		sql: `
			UPDATE ventas
			SET subtotal = ?, monto_envio = ?, total = ?, nota = ?, actualizado_en = CURRENT_TIMESTAMP
			WHERE id = ?
		`,
		args: [subtotal, montoEnvio, total, nota, pedidoId],
	});

	// 4. Auditoría
	await registrarAuditoria({
		usuarioId: actor.id,
		entidad: 'ventas',
		entidadId: pedidoId,
		accion: 'actualizar',
		actor,
		cambios: {
			codigo: pedidoActual.codigo,
			subtotalAnterior: pedidoActual.subtotal,
			subtotalNuevo: subtotal,
			montoEnvio,
			total,
			itemsCount: input.items.length,
		},
	});

	const actualizado = await getPedidoById(pedidoId);
	return actualizado!;
}

/**
 * Acepta / confirma una venta:
 * Estado pasa a 'confirmada', stock queda consolidado y cuenta para estadísticas.
 */
export async function confirmarPedido(pedidoId: string, actor: ActorAuditoria): Promise<Pedido> {
	await ensurePedidosSchema();
	const db = getDb();

	const pedido = await getPedidoById(pedidoId);
	if (!pedido) throw new Error('Pedido no encontrado');
	if (pedido.estado === 'confirmada') return pedido;

	if (pedido.estado === 'cancelada') {
		// Si venía de cancelada, volvemos a reservar el stock de los productos
		for (const it of pedido.items) {
			const varId = it.variante_id;
			if (varId) {
				const cur = await db.execute({
					sql: `SELECT stock FROM producto_stock_variantes WHERE id = ?`,
					args: [varId],
				});
				const ant = cur.rows[0] ? Number((cur.rows[0] as Record<string, unknown>).stock ?? 0) : 0;
				const nvo = Math.max(0, ant - it.cantidad);
				await db.execute({
					sql: `UPDATE producto_stock_variantes SET stock = ? WHERE id = ?`,
					args: [nvo, varId],
				});
				await registrarMovimientoStock({
					productoId: it.producto_id,
					varianteId: varId,
					tipo: 'venta',
					cantidad: it.cantidad,
					stockAnterior: ant,
					stockNuevo: nvo,
					motivo: `Pedido #${pedido.codigo} reactivado / confirmado`,
					usuarioId: actor.id,
				});
			}
		}
	}

	await db.execute({
		sql: `
			UPDATE ventas
			SET estado = 'confirmada', confirmado_por = ?, actualizado_en = CURRENT_TIMESTAMP
			WHERE id = ?
		`,
		args: [actor.id, pedidoId],
	});

	await registrarAuditoria({
		usuarioId: actor.id,
		entidad: 'ventas',
		entidadId: pedidoId,
		accion: 'confirmar',
		actor,
		cambios: {
			codigo: pedido.codigo,
			total: pedido.total,
			cliente: pedido.cliente_nombre,
			accion: 'Venta aceptada y aprobada por el administrador',
		},
	});

	const actualizado = await getPedidoById(pedidoId);
	return actualizado!;
}

/**
 * Cancela una venta:
 * Estado pasa a 'cancelada', y TODO el stock descontado preventivamente se devuelve al inventario.
 */
export async function cancelarPedido(pedidoId: string, actor: ActorAuditoria): Promise<Pedido> {
	await ensurePedidosSchema();
	const db = getDb();

	const pedido = await getPedidoById(pedidoId);
	if (!pedido) throw new Error('Pedido no encontrado');
	if (pedido.estado === 'cancelada') return pedido;

	// DEVOLVER STOCK AL INVENTARIO (Reposición)
	for (const it of pedido.items) {
		const varId = it.variante_id || (await (async () => {
			if (!it.producto_id) return null;
			const r = await db.execute({
				sql: `SELECT id FROM producto_stock_variantes WHERE producto_id = ? LIMIT 1`,
				args: [it.producto_id],
			});
			return r.rows[0] ? String((r.rows[0] as Record<string, unknown>).id) : null;
		})());

		if (varId) {
			const cur = await db.execute({
				sql: `SELECT stock FROM producto_stock_variantes WHERE id = ?`,
				args: [varId],
			});
			const ant = cur.rows[0] ? Number((cur.rows[0] as Record<string, unknown>).stock ?? 0) : 0;
			const nvo = ant + it.cantidad;
			await db.execute({
				sql: `UPDATE producto_stock_variantes SET stock = ? WHERE id = ?`,
				args: [nvo, varId],
			});
			await registrarMovimientoStock({
				productoId: it.producto_id,
				varianteId: varId,
				tipo: 'devolucion',
				cantidad: it.cantidad,
				stockAnterior: ant,
				stockNuevo: nvo,
				motivo: `Cancelación de pedido #${pedido.codigo} - Reposición a inventario`,
				usuarioId: actor.id,
			});
		}
	}

	await db.execute({
		sql: `
			UPDATE ventas
			SET estado = 'cancelada', actualizado_en = CURRENT_TIMESTAMP
			WHERE id = ?
		`,
		args: [pedidoId],
	});

	await registrarAuditoria({
		usuarioId: actor.id,
		entidad: 'ventas',
		entidadId: pedidoId,
		accion: 'cancelar',
		actor,
		cambios: {
			codigo: pedido.codigo,
			totalDevuelto: pedido.total,
			cliente: pedido.cliente_nombre,
			accion: 'Venta cancelada: stock preventivo devuelto al inventario',
		},
	});

	const actualizado = await getPedidoById(pedidoId);
	return actualizado!;
}

/**
 * Obtiene métricas y tablas de ventas para la página de estadísticas
 */
export async function getEstadisticasVentas(): Promise<EstadisticasVentas> {
	await ensurePedidosSchema();
	const db = getDb();

	const statsQuery = await db.execute(`
		SELECT
			estado,
			COUNT(*) AS cantidad,
			COALESCE(SUM(total), 0) AS monto
		FROM ventas
		GROUP BY estado
	`);

	let totalConfirmadas = 0;
	let montoConfirmadas = 0;
	let totalCanceladas = 0;
	let montoCanceladas = 0;
	let totalPendientes = 0;
	let montoPendientes = 0;

	for (const raw of statsQuery.rows) {
		const r = raw as Record<string, unknown>;
		const estado = String(r.estado);
		const cant = Number(r.cantidad ?? 0);
		const monto = Number(r.monto ?? 0);

		if (estado === 'confirmada') {
			totalConfirmadas = cant;
			montoConfirmadas = monto;
		} else if (estado === 'cancelada') {
			totalCanceladas = cant;
			montoCanceladas = monto;
		} else if (estado === 'pendiente') {
			totalPendientes = cant;
			montoPendientes = monto;
		}
	}

	const ticketPromedio = totalConfirmadas > 0 ? montoConfirmadas / totalConfirmadas : 0;
	const totalCerradas = totalConfirmadas + totalCanceladas;
	const tasaEfectividad = totalCerradas > 0 ? Math.round((totalConfirmadas / totalCerradas) * 100) : 0;

	// Listados de pedidos por estado
	const ultimasConfirmadas = await listPedidos({ estado: 'confirmada' });
	const ultimasPendientes = await listPedidos({ estado: 'pendiente' });
	const ultimasCanceladas = await listPedidos({ estado: 'cancelada' });

	// 1. Productos más vendidos (en ventas aprobadas/confirmadas)
	const masVendidosQuery = await db.execute(`
		SELECT
			p.id,
			p.nombre,
			(SELECT url FROM productos_imagenes WHERE producto_id = p.id ORDER BY orden ASC LIMIT 1) AS imagen_url,
			COALESCE(SUM(vi.cantidad), 0) AS unidades_vendidas,
			COALESCE(SUM(vi.subtotal), 0) AS monto_total,
			COALESCE((SELECT SUM(stock) FROM producto_stock_variantes WHERE producto_id = p.id), 0) AS stock_actual
		FROM productos p
		INNER JOIN venta_items vi ON vi.producto_id = p.id
		INNER JOIN ventas v ON v.id = vi.venta_id
		WHERE v.estado = 'confirmada'
		GROUP BY p.id, p.nombre
		ORDER BY unidades_vendidas DESC, monto_total DESC
		LIMIT 100
	`);

	const masVendidos: ProductoRanking[] = masVendidosQuery.rows.map((raw) => {
		const r = raw as Record<string, unknown>;
		return {
			id: String(r.id),
			nombre: String(r.nombre),
			imagen_url: r.imagen_url ? String(r.imagen_url) : null,
			unidades_vendidas: Number(r.unidades_vendidas ?? 0),
			monto_total: Number(r.monto_total ?? 0),
			stock_actual: Number(r.stock_actual ?? 0),
		};
	});

	// 2. Productos menos vendidos (con pocas o 0 ventas en confirmadas)
	const menosVendidosQuery = await db.execute(`
		SELECT
			p.id,
			p.nombre,
			(SELECT url FROM productos_imagenes WHERE producto_id = p.id ORDER BY orden ASC LIMIT 1) AS imagen_url,
			COALESCE(SUM(CASE WHEN v.estado = 'confirmada' THEN vi.cantidad ELSE 0 END), 0) AS unidades_vendidas,
			COALESCE(SUM(CASE WHEN v.estado = 'confirmada' THEN vi.subtotal ELSE 0 END), 0) AS monto_total,
			COALESCE((SELECT SUM(stock) FROM producto_stock_variantes WHERE producto_id = p.id), 0) AS stock_actual
		FROM productos p
		LEFT JOIN venta_items vi ON vi.producto_id = p.id
		LEFT JOIN ventas v ON v.id = vi.venta_id
		WHERE p.activo = 1
		GROUP BY p.id, p.nombre
		ORDER BY unidades_vendidas ASC, stock_actual DESC
		LIMIT 100
	`);

	const menosVendidos: ProductoRanking[] = menosVendidosQuery.rows.map((raw) => {
		const r = raw as Record<string, unknown>;
		return {
			id: String(r.id),
			nombre: String(r.nombre),
			imagen_url: r.imagen_url ? String(r.imagen_url) : null,
			unidades_vendidas: Number(r.unidades_vendidas ?? 0),
			monto_total: Number(r.monto_total ?? 0),
			stock_actual: Number(r.stock_actual ?? 0),
		};
	});

	// 3. Inventario: Productos / Variantes con baja existencia (1 a 5 unidades) y Agotados (0 unidades)
	const inventarioAlertasQuery = await db.execute(`
		SELECT
			v.id,
			v.producto_id,
			p.nombre,
			v.combinacion,
			v.sku,
			v.stock,
			v.precio,
			(SELECT url FROM productos_imagenes WHERE producto_id = p.id ORDER BY orden ASC LIMIT 1) AS imagen_url
		FROM producto_stock_variantes v
		INNER JOIN productos p ON p.id = v.producto_id
		WHERE p.activo = 1 AND v.stock <= 5
		ORDER BY v.stock ASC, p.nombre ASC
	`);

	const bajaExistencia: ProductoStockAlerta[] = [];
	const agotados: ProductoStockAlerta[] = [];

	for (const raw of inventarioAlertasQuery.rows) {
		const r = raw as Record<string, unknown>;
		const stock = Number(r.stock ?? 0);
		const alerta: ProductoStockAlerta = {
			id: String(r.id),
			producto_id: String(r.producto_id),
			nombre: String(r.nombre),
			combinacion: String(r.combinacion || 'Único'),
			sku: String(r.sku || ''),
			stock,
			precio: Number(r.precio ?? 0),
			imagen_url: r.imagen_url ? String(r.imagen_url) : null,
			estado: stock === 0 ? 'agotado' : 'baja_existencia',
		};

		if (stock === 0) {
			agotados.push(alerta);
		} else {
			bajaExistencia.push(alerta);
		}
	}

	// 4. Flujo de dinero de ventas aprobadas agrupado por fecha (últimos 30 días o histórico diario)
	const flujoQuery = await db.execute(`
		SELECT
			SUBSTR(creado_en, 1, 10) AS fecha_dia,
			COALESCE(SUM(total), 0) AS monto,
			COUNT(*) AS cantidad
		FROM ventas
		WHERE estado = 'confirmada'
		GROUP BY fecha_dia
		ORDER BY fecha_dia ASC
		LIMIT 30
	`);

	const flujoAprobadas: FlujoVentasPunto[] = flujoQuery.rows.map((raw) => {
		const r = raw as Record<string, unknown>;
		const f = String(r.fecha_dia || '');
		let label = f;
		try {
			const parts = f.split('-');
			if (parts.length === 3) {
				const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
				label = new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short' }).format(d);
			}
		} catch {
			label = f;
		}
		return {
			fecha: f,
			label,
			monto: Number(r.monto ?? 0),
			cantidad: Number(r.cantidad ?? 0),
		};
	});

	return {
		totalConfirmadas,
		montoConfirmadas,
		totalCanceladas,
		montoCanceladas,
		totalPendientes,
		montoPendientes,
		ticketPromedio,
		tasaEfectividad,
		ultimasConfirmadas,
		ultimasPendientes,
		ultimasCanceladas,
		masVendidos,
		menosVendidos,
		bajaExistencia,
		agotados,
		flujoAprobadas,
	};
}
