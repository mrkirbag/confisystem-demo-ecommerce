-- Agregar precio_oferta por variante
ALTER TABLE producto_stock_variantes ADD COLUMN precio_oferta REAL NOT NULL DEFAULT 0;
