export type ProductSlot = 1 | 2 | 3;

export const COMBINACION_UNICA = 'Único';
export const MAX_COMBINACIONES = 48;
export const MAX_IMAGENES = 3;
export const SKU_MAX_LENGTH = 40;
export const PRODUCT_SLOTS: ProductSlot[] = [1, 2, 3];

export type ProductoImagen = {
	id: string;
	url: string;
	orden: ProductSlot;
};

export type ProductoVariante = {
	id: string;
	combinacion: string;
	stock: number;
	sku: string;
	precio: number;
};

export type ProductoDetalleTexto = {
	id: string;
	atributo_id: string;
	valor: string;
};

export type ProductoListado = {
	id: string;
	categoria_id: string;
	categoria_nombre: string;
	nombre: string;
	slug: string;
	imagen_url: string | null;
	precio_base: number;
	es_tendencia: boolean;
	en_oferta: boolean;
	precio_oferta: number;
	precio_por_variante: boolean;
	precio_min: number;
	precio_max: number;
	activo: boolean;
	stock_total: number;
	skus: string[];
};

export type Producto = ProductoListado & {
	descripcion: string;
	creado_en: string;
	imagenes: ProductoImagen[];
	variantes: ProductoVariante[];
	detalles: ProductoDetalleTexto[];
};

export type CombinacionParte = {
	nombre: string;
	valor: string;
};

export function formatPrecio(value: number) {
	return new Intl.NumberFormat('es-VE', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
	}).format(value);
}

export function formatPrecioRango(min: number, max: number) {
	if (!Number.isFinite(min) || !Number.isFinite(max)) return formatPrecio(0);
	if (min === max) return formatPrecio(min);
	return `${formatPrecio(Math.min(min, max))} – ${formatPrecio(Math.max(min, max))}`;
}

export function formatStock(value: number) {
	return value === 1 ? '1 ud.' : `${value} uds.`;
}

export function descuentoPorcentaje(normal: number, oferta: number) {
	if (!Number.isFinite(normal) || !Number.isFinite(oferta)) return 0;
	if (normal <= 0 || oferta <= 0 || oferta >= normal) return 0;
	return Math.max(1, Math.round((1 - oferta / normal) * 100));
}

export function formatCombinacion(parts: CombinacionParte[]) {
	if (parts.length === 0) return COMBINACION_UNICA;
	return parts.map((part) => `${part.nombre}: ${part.valor}`).join(' / ');
}

export function parseCombinacion(combinacion: string): CombinacionParte[] {
	const raw = combinacion.trim();
	if (!raw || raw === COMBINACION_UNICA) return [];

	return raw
		.split(' / ')
		.map((part) => {
			const index = part.indexOf(': ');
			if (index === -1) return { nombre: '', valor: part.trim() };
			return {
				nombre: part.slice(0, index).trim(),
				valor: part.slice(index + 2).trim(),
			};
		})
		.filter((part) => part.valor.length > 0);
}

export function cartesianCombinaciones(grupos: { nombre: string; valores: string[] }[]) {
	const usable = grupos.filter((grupo) => grupo.nombre && grupo.valores.length > 0);
	if (usable.length === 0) return [COMBINACION_UNICA];

	let rows: CombinacionParte[][] = [[]];
	for (const grupo of usable) {
		const next: CombinacionParte[][] = [];
		for (const row of rows) {
			for (const valor of grupo.valores) {
				next.push([...row, { nombre: grupo.nombre, valor }]);
			}
		}
		rows = next;
		if (rows.length > MAX_COMBINACIONES) return [];
	}

	return rows.map((parts) => formatCombinacion(parts));
}

export function inferVarianteSeleccion(
	variantes: { combinacion: string }[],
	atributos: { id: string; nombre: string; tipo: string }[],
) {
	const unique = atributos.filter((item) => item.tipo === 'seleccion_unica');
	const parts = variantes.flatMap((item) => parseCombinacion(item.combinacion));
	const atributoIds: string[] = [];
	const opciones: Record<string, string[]> = {};

	for (const atributo of unique) {
		const valores = [
			...new Set(parts.filter((part) => part.nombre === atributo.nombre).map((part) => part.valor)),
		];
		if (valores.length === 0) continue;
		atributoIds.push(atributo.id);
		opciones[atributo.id] = valores;
	}

	return { atributoIds, opciones };
}

export function toListado(item: Producto): ProductoListado {
	const precios = item.variantes.map((variante) => variante.precio).filter((value) => Number.isFinite(value));
	const min = item.precio_por_variante && precios.length > 0 ? Math.min(...precios) : item.precio_base;
	const max = item.precio_por_variante && precios.length > 0 ? Math.max(...precios) : item.precio_base;

	return {
		id: item.id,
		categoria_id: item.categoria_id,
		categoria_nombre: item.categoria_nombre,
		nombre: item.nombre,
		slug: item.slug,
		imagen_url: item.imagenes[0]?.url ?? item.imagen_url,
		precio_base: item.precio_base,
		es_tendencia: item.es_tendencia,
		en_oferta: item.en_oferta,
		precio_oferta: item.precio_oferta,
		precio_por_variante: item.precio_por_variante,
		precio_min: min,
		precio_max: max,
		activo: item.activo,
		stock_total: item.variantes.reduce((total, variante) => total + variante.stock, 0),
		skus: item.variantes.map((variante) => variante.sku).filter(Boolean),
	};
}

function skuToken(value: string, max: number) {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, max);
}

export function buildSkuBase(slug: string, combinacion: string) {
	const product = skuToken(slug, 18) || 'PROD';
	const parts = parseCombinacion(combinacion);
	if (parts.length === 0) return product.slice(0, SKU_MAX_LENGTH);

	const suffix = parts
		.map((part) => skuToken(part.valor, 8))
		.filter(Boolean)
		.join('-');
	const base = suffix ? `${product}-${suffix}` : product;
	return base.slice(0, SKU_MAX_LENGTH);
}

export function nextUniqueSku(base: string, taken: Set<string>) {
	const seed = (base || 'PROD').slice(0, SKU_MAX_LENGTH);
	let sku = seed;
	let n = 2;
	while (taken.has(sku.toUpperCase())) {
		const extra = `-${n}`;
		sku = `${seed.slice(0, SKU_MAX_LENGTH - extra.length)}${extra}`;
		n += 1;
	}
	return sku;
}

export function allocateSkus(
	slug: string,
	combinaciones: string[],
	existing: Record<string, string> = {},
	takenExternal: Iterable<string> = [],
) {
	const taken = new Set(
		[...takenExternal, ...Object.values(existing)]
			.map((value) => value.trim().toUpperCase())
			.filter(Boolean),
	);
	const result: Record<string, string> = {};

	for (const combinacion of combinaciones) {
		const kept = existing[combinacion]?.trim();
		if (kept) {
			result[combinacion] = kept;
			continue;
		}
		const sku = nextUniqueSku(buildSkuBase(slug, combinacion), taken);
		taken.add(sku.toUpperCase());
		result[combinacion] = sku;
	}

	return result;
}

export function formatSkus(skus: string[]) {
	if (skus.length === 0) return '';
	if (skus.length === 1) return skus[0];
	if (skus.length === 2) return `${skus[0]} · ${skus[1]}`;
	return `${skus[0]} +${skus.length - 1}`;
}

export function initialsFromName(nombre: string) {
	const parts = nombre.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return 'P';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
