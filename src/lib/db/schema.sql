-- ==========================================
-- Demo Ecommerce — esquema Turso / libSQL
-- Aplicar con:
--   turso db shell <nombre-db> < src/lib/db/schema.sql
-- o desde el dashboard SQL de Turso.
-- ==========================================

PRAGMA foreign_keys = ON;

-- ==========================================
-- 1. CONFIGURACIÓN E IDENTIDAD DE LA TIENDA
-- ==========================================

CREATE TABLE IF NOT EXISTS tienda_configuracion (
    id TEXT PRIMARY KEY,
    nombre_tienda TEXT,
    rif TEXT,
    telefono TEXT,
    correo TEXT,
    direccion TEXT,
    horario TEXT,
    instagram TEXT,
    tiktok TEXT,
    whatsapp TEXT,
    logo_url TEXT,
    google_analytics TEXT
);

CREATE TABLE IF NOT EXISTS tienda_personalizacion (
    id TEXT PRIMARY KEY,
    color_primario TEXT DEFAULT '#000000',
    color_secundario TEXT DEFAULT '#ffffff',
    color_fondo TEXT DEFAULT '#f9fafb',
    color_texto TEXT DEFAULT '#111827',
    fuente_titulos TEXT DEFAULT 'Poppins',
    fuente_cuerpo TEXT DEFAULT 'Inter'
);


-- ==========================================
-- 2. ACCESO Y ADMINISTRACIÓN
-- ==========================================

CREATE TABLE IF NOT EXISTS usuarios_admin (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT DEFAULT 'admin',
    activo BOOLEAN DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 3. CATÁLOGO DE PRODUCTOS
-- ==========================================

CREATE TABLE IF NOT EXISTS categorias (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    imagen_url TEXT,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    categoria_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    precio_base REAL NOT NULL,

    es_tendencia BOOLEAN DEFAULT 0,
    en_oferta BOOLEAN DEFAULT 0,
    precio_oferta REAL DEFAULT 0,
    precio_por_variante BOOLEAN DEFAULT 0,

    activo BOOLEAN DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS productos_imagenes (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    url TEXT NOT NULL,
    orden INTEGER DEFAULT 1,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);


-- ==========================================
-- 4. CONFIGURACIÓN GLOBAL DE ATRIBUTOS
-- ==========================================

CREATE TABLE IF NOT EXISTS atributos_config (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('multiseleccion', 'seleccion_unica', 'texto', 'numero'))
);

CREATE TABLE IF NOT EXISTS atributos_opciones (
    id TEXT PRIMARY KEY,
    atributo_id TEXT NOT NULL,
    valor TEXT NOT NULL,
    FOREIGN KEY (atributo_id) REFERENCES atributos_config(id) ON DELETE CASCADE
);


-- ==========================================
-- 5. INVENTARIO, VARIANTES Y DETALLES
-- ==========================================

CREATE TABLE IF NOT EXISTS producto_stock_variantes (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    combinacion TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    sku TEXT NOT NULL,
    precio REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS producto_detalles_texto (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    atributo_id TEXT NOT NULL,
    valor TEXT NOT NULL,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (atributo_id) REFERENCES atributos_config(id) ON DELETE CASCADE
);


-- ==========================================
-- 6. VENTAS (reserva al enviar a WhatsApp)
-- Cliente: formulario nombre / cédula / teléfono
-- Estados: pendiente → confirmada | cancelada
-- ==========================================

CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,

    cliente_nombre TEXT NOT NULL,
    cliente_cedula TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    nota TEXT,

    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),

    total REAL NOT NULL DEFAULT 0,

    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmado_por TEXT,

    FOREIGN KEY (confirmado_por) REFERENCES usuarios_admin(id)
);

CREATE TABLE IF NOT EXISTS venta_items (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    variante_id TEXT,
    nombre_producto TEXT NOT NULL,
    combinacion TEXT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,

    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (variante_id) REFERENCES producto_stock_variantes(id)
);


-- ==========================================
-- 7. AUDITORÍA Y TRAZABILIDAD
-- ==========================================

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id TEXT PRIMARY KEY,
    usuario_id TEXT,
    entidad_afectada TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    accion TEXT NOT NULL,
    cambios_json TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL
);


-- ==========================================
-- ÍNDICES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_imagenes_producto ON productos_imagenes(producto_id);
CREATE INDEX IF NOT EXISTS idx_variantes_producto ON producto_stock_variantes(producto_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variantes_sku ON producto_stock_variantes(sku);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_creado_en ON ventas(creado_en);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_cedula ON ventas(cliente_cedula);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_telefono ON ventas(cliente_telefono);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_entidad ON bitacora_auditoria(entidad_afectada, entidad_id);
