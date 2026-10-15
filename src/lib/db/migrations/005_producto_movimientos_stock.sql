-- Movimientos de stock para productos y variantes
-- Permite registrar adiciones manuales, reducciones manuales,
-- ventas (descuento) y cancelaciones de ventas (reposición / retorno).

CREATE TABLE IF NOT EXISTS producto_movimientos_stock (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    variante_id TEXT,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'venta', 'devolucion', 'ajuste')),
    cantidad INTEGER NOT NULL,
    stock_anterior INTEGER NOT NULL,
    stock_nuevo INTEGER NOT NULL,
    motivo TEXT,
    usuario_id TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (variante_id) REFERENCES producto_stock_variantes(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON producto_movimientos_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON producto_movimientos_stock(fecha_registro);
