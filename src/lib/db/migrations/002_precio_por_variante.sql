ALTER TABLE productos ADD COLUMN precio_por_variante INTEGER NOT NULL DEFAULT 0;

UPDATE productos SET precio_por_variante = 1
WHERE id IN (
    SELECT producto_id
    FROM producto_stock_variantes
    GROUP BY producto_id
    HAVING MIN(precio) <> MAX(precio)
);
