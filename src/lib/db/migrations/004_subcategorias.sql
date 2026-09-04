-- Subcategorías: nombre + imagen, pertenecen a una categoría.
-- Los productos se asignan a la subcategoría.
-- Turso / libSQL. CREATE TABLE IF NOT EXISTS es idempotente.
-- ALTER TABLE: si falla con "duplicate column", ignóralo.

CREATE TABLE IF NOT EXISTS subcategorias (
    id TEXT PRIMARY KEY,
    categoria_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL,
    imagen_url TEXT,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT 1,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    UNIQUE (categoria_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON subcategorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_activo ON subcategorias(activo);

ALTER TABLE productos ADD COLUMN subcategoria_id TEXT REFERENCES subcategorias(id);

CREATE INDEX IF NOT EXISTS idx_productos_subcategoria ON productos(subcategoria_id);
