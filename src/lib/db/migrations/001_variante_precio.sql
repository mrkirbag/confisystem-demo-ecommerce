-- Precio por variante (talla, color, etc.)
-- Turso / libSQL. Seguro ejecutar más de una vez si ya existe la columna:
--   si falla con "duplicate column", ignóralo.

ALTER TABLE producto_stock_variantes ADD COLUMN precio REAL NOT NULL DEFAULT 0;

UPDATE producto_stock_variantes
SET precio = COALESCE((
    SELECT precio_base FROM productos WHERE productos.id = producto_stock_variantes.producto_id
), 0)
WHERE precio = 0;
