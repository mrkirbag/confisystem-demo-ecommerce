# Manual de Usuario - Panel Administrativo

Este documento constituye la guía operativa para el propietario y administradores de la tienda. Aquí se describen de manera clara y detallada todas las secciones, herramientas y flujos de trabajo disponibles en el panel de control.

---

## Tabla de Contenido

1. [Acceso al Sistema](#1-acceso-al-sistema)
2. [Estructura General del Panel](#2-estructura-general-del-panel)
3. [Conversión de Moneda y Tasas](#3-conversión-de-moneda-y-tasas)
4. [Dashboard (Panel Principal)](#4-dashboard-panel-principal)
5. [Gestión del Catálogo](#5-gestión-del-catálogo)
   - [Categorías](#51-categorías)
   - [Subcategorías](#52-subcategorías)
   - [Atributos y Variantes](#53-atributos-y-variantes)
   - [Productos](#54-productos)
6. [Gestión de Pedidos y Ventas](#6-gestión-de-pedidos-y-ventas)
   - [Estados de un Pedido](#61-estados-de-un-pedido)
   - [Detalle, Facturación y Edición de Pedido](#62-detalle-facturación-y-edición-de-pedido)
7. [Métricas y Estadísticas](#7-métricas-y-estadísticas)
8. [Configuración General](#8-configuración-general)
   - [Datos de la Tienda](#81-datos-de-la-tienda)
   - [Identidad Visual y Personalización](#82-identidad-visual-y-personalización)
   - [Gestión de Usuarios y Accesos](#83-gestión-de-usuarios-y-accesos)
9. [Cierre de Sesión Seguro](#9-cierre-de-sesión-seguro)

---

## 1. Acceso al Sistema

Para ingresar a la administración de su tienda:

1. Diríjase a la ruta `/admin/login` desde su navegador.
2. Ingrese su **Correo Electrónico** y **Contraseña**.
3. Haga clic en **Iniciar Sesión**.

> **Nota de Seguridad**: Si intenta ingresar a cualquier sección administrativa sin haber iniciado sesión previamente, el sistema lo redirigirá de manera automática al formulario de inicio de sesión.

---

## 2. Estructura General del Panel

El panel administrativo cuenta con una barra de navegación lateral (en computadoras) o menú desplegable (en dispositivos móviles) distribuido en:

* **Cabecera**: Logotipo y nombre comercial de la tienda, junto al selector de moneda.
* **Menú de Navegación**: Enlaces directos a Catálogo, Pedidos, Estadísticas y Configuración.
* **Pie del Menú**: Botón con enlace al **Manual de usuario** y el botón para **Cerrar sesión**.

---

## 3. Conversión de Moneda y Tasas

En la parte superior del menú lateral y en la cabecera móvil encontrará el **Selector de Moneda**.

* Permite previsualizar los montos en **Dólares estadounidenses (USD / $)**, **Bolívares (VES / Bs.)** calculados a la tasa de cambio establecida por la tienda, o **Pesos Colombianos (COP / $)**.
* Las tasas de cambio oficiales se configuran en **Configuración > Tienda**. Todas las conversiones se efectúan de forma automática en tiempo real tanto en la administración como en la vitrina pública.

---

## 4. Dashboard (Panel Principal)

Al autenticarse, aterrizará en el Dashboard general (`/admin`), el cual ofrece un vistazo rápido del estado comercial:

* **Ventas pendientes**: Número de pedidos recibidos por confirmar con stock reservado.
* **Ventas aprobadas**: Monto total acumulado de compras confirmadas y facturadas.
* **Productos activos**: Total de artículos publicados y visibles en la tienda en línea.

Cada tarjeta funciona como acceso directo a su sección correspondiente.

---

## 5. Gestión del Catálogo

El menú **Catálogo** agrupa los cuatro pilares para organizar la oferta comercial. Se recomienda configurarlos en el siguiente orden secuencial:

### 5.1. Categorías
* **Ruta**: `/admin/catalogo/categorias`
* Representa las divisiones macro de su negocio (ejemplo: *Calzado*, *Ropa*, *Tecnología*).
* Permite crear, renombrar, asignar slugs amigables para buscadores y alternar la visibilidad de cada categoría.

### 5.2. Subcategorías
* **Ruta**: `/admin/catalogo/subcategorias`
* Permite subdividir las categorías principales para facilitar la navegación del comprador (ejemplo: dentro de *Calzado* crear *Deportivos*, *Casuales*, *Formales*).
* Al crear una subcategoría se debe seleccionar su categoría padre correspondiente.

### 5.3. Atributos y Variantes
* **Ruta**: `/admin/catalogo/atributos`
* Los atributos son las características o propiedades diferenciadoras que definen las opciones de compra de un artículo. Son fundamentales cuando un mismo producto se comercializa en múltiples presentaciones (por ejemplo: diferentes tallas, colores, capacidades de almacenamiento o materiales).

#### ¿Cómo funcionan los Atributos y sus Opciones?
1. **Definición del Atributo**: Es el nombre del rasgo distintivo general (por ejemplo: `Talla`, `Color`, `Memoria RAM`, `Volumen`).
2. **Valores u Opciones**: Dentro de cada atributo se agregan todas las opciones posibles que los clientes podrán elegir. Por ejemplo:
   * Para el atributo `Talla`: `XS`, `S`, `M`, `L`, `XL`, `XXL` o numéricas `36`, `38`, `40`, `42`.
   * Para el atributo `Color`: `Negro`, `Blanco`, `Azul Marino`, `Rojo Carmín`, `Verde Oliva`.
   * Para el atributo `Almacenamiento`: `64 GB`, `128 GB`, `256 GB`, `512 GB`.

#### Vinculación con los Productos y Generación de Combinaciones
* Cuando ingresa a crear o editar un producto en **Catálogo > Productos**, puede activar la casilla de variantes y asociar uno o más atributos previamente registrados (por ejemplo, combinar `Talla` + `Color`).
* El sistema generará una matriz con cada combinación resultante (ejemplo: `M / Negro`, `M / Blanco`, `L / Negro`, `L / Blanco`).
* Para cada combinación particular usted podrá definir:
  * **Stock individual**: Control estricto de existencias por variante para evitar vender artículos agotados.
  * **Código SKU propio**: Identificador de inventario único para agilizar el despacho en almacén.
  * **Precio diferenciado u oferta**: Si una variante específica tiene costo superior (ejemplo: tallas especiales o mayor capacidad de almacenamiento) o un descuento exclusivo.

#### Reglas de Integridad y Eliminación Segura
* **Protección contra borrado accidental**: El sistema cuenta con validación de dependencias. Si un atributo ya está siendo utilizado por uno o varios productos en inventario, el botón de eliminar estará bloqueado y se indicará exactamente cuántos productos dependen de él.
* **Buenas prácticas**: Cree primero los atributos de uso frecuente antes de comenzar la carga masiva de productos. Esto le ahorrará tiempo y mantendrá la consistencia del catálogo en toda la tienda.

### 5.4. Productos
* **Ruta**: `/admin/catalogo/productos`
* Es el módulo principal de inventario. Le permite:
  * **Crear nuevo producto**: Asignar nombre, descripción, categoría, subcategoría y precio base.
  * **Imágenes**: Cargar fotografías de alta resolución optimizadas para carga rápida en WebP.
  * **Variantes y Stock**: Definir si el producto tiene stock único o combinaciones de atributos (ejemplo: Talla M / Color Negro con 10 unidades; Talla L / Color Azul con 5 unidades).
  * **Precios de Oferta**: Asignar descuentos promocionales con cálculo automático de porcentaje de ahorro.
  * **Estado Activo / Inactivo**: Ocultar temporalmente productos sin eliminarlos del historial.

---

## 6. Gestión de Pedidos y Ventas

* **Ruta**: `/admin/pedidos`
* Centraliza todos los pedidos generados por los clientes en la tienda.

### 6.1. Estados de un Pedido

1. **Pendiente**:
   * El cliente completó la solicitud de compra.
   * El stock de los productos seleccionados queda **reservado** automáticamente para evitar sobreventa.
2. **Confirmada (Aprobada)**:
   * Se verificó el comprobante o recepción del pago.
   * La venta queda registrada contablemente y el inventario queda descontado definitivamente.
3. **Cancelada**:
   * El cliente desestimó la compra o el pago no fue concretado.
   * El sistema **reintegra de inmediato el stock** al inventario para que vuelva a estar disponible al público.

### 6.2. Detalle, Facturación y Edición de Pedido

Al hacer clic en cualquier pedido (`/admin/pedidos/[id]`) podrá:

* **Inspeccionar datos del cliente**: Nombre, cédula/RIF, teléfono, correo y dirección de entrega.
* **Modificar ítems**: Agregar productos adicionales, cambiar variantes de producto o ajustar cantidades solicitadas.
* **Generar Comprobante PDF**: Descargar o imprimir la nota de entrega / factura formal con formato corporativo.
* **Acceso rápido a WhatsApp**: Botón directo para contactar al cliente con mensaje preconfigurado sobre el estatus de su pedido.

---

## 7. Métricas y Estadísticas

* **Ruta**: `/admin/estadisticas`
* Presenta informes visuales y analíticos detallados para la toma de decisiones:
  * **Flujo cronológico de ingresos**: Gráficos interactivos de ventas en el tiempo.
  * **Productos más vendidos**: Ranking de artículos con mayor rotación y volumen de facturación.
  * **Distribución de pedidos**: Proporción porcentual entre pedidos confirmados, pendientes y cancelados.
  * **Exportación y auditoría**: Tablas consolidadas con desglose de montos y fechas de liquidación.

---

## 8. Configuración General

El módulo **Configuración** permite parametrizar las bases del sistema:

### 8.1. Datos de la Tienda
* **Ruta**: `/admin/configuracion/tienda`
* **Información Comercial**: Nombre oficial, RIF / NIT, teléfonos de contacto, correo y dirección física.
* **Redes y Mensajería**: Enlaces a WhatsApp, Instagram y TikTok que alimentan los accesos directos de la tienda.
* **Tasas de Cambio**: Configuración del valor de la tasa del dólar a Bolívares (Bs.) y tasa COP ($).
* **Logotipo**: Carga y actualización de la imagen institucional visible en la cabecera, pie de página y favicons.

### 8.2. Identidad Visual y Personalización
* **Ruta**: `/admin/configuracion/identidad-visual`
* Permite adecuar el estilo visual a la identidad de su marca sin tocar código:
  * **Color Primario**: Aplica en botones de acción principal, badges y destacados.
  * **Color Secundario**: Aplica en barras laterales, fondos de tarjetas y contenedores.
  * **Color de Fondo y Texto**: Define la atmósfera clara u oscura del sitio.
  * **Tipografías**: Selección de fuentes para títulos y cuerpo de texto optimizadas desde Google Fonts.

### 8.3. Gestión de Usuarios y Accesos
* **Ruta**: `/admin/configuracion/usuarios`
* Permite dar de alta a administradores o colaboradores de su equipo.
* Cada usuario cuenta con sus propias credenciales seguras cifradas con algoritmo robusto (bcrypt).
* Posibilidad de actualizar contraseñas y desactivar accesos en caso de rotación de personal.

---

## 9. Cierre de Sesión Seguro

Para proteger la integridad de sus datos, una vez finalizada la jornada de trabajo:

1. Desplácese al pie del menú lateral izquierdo.
2. Haga clic en el botón **Cerrar sesión**.
3. El sistema invalidará la sesión activa de forma segura.
