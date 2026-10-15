-- Migración: Tasas de cambio multitasa (Bolívares y Pesos Colombianos COP)
-- Turso / libSQL

ALTER TABLE tienda_configuracion ADD COLUMN tasa_bcv REAL DEFAULT NULL;
ALTER TABLE tienda_configuracion ADD COLUMN tasa_cop REAL DEFAULT NULL;
