-- SKU único por combinación (y por producto sin variantes).
-- El backfill de códigos vacíos lo hace ensureProductoSchema() al arrancar.

CREATE UNIQUE INDEX IF NOT EXISTS idx_variantes_sku ON producto_stock_variantes(sku);
