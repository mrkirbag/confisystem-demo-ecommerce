export const ATRIBUTO_TIPOS = ['seleccion_unica', 'multiseleccion', 'texto', 'numero'] as const;

export type AtributoTipo = (typeof ATRIBUTO_TIPOS)[number];

export type AtributoOpcion = {
	id: string;
	valor: string;
};

export type Atributo = {
	id: string;
	nombre: string;
	tipo: AtributoTipo;
	opciones: AtributoOpcion[];
	usos: number;
};

export const TIPO_INFO: Record<
	AtributoTipo,
	{ label: string; hint: string; example: string; needsOptions: boolean }
> = {
	seleccion_unica: {
		label: 'Elige una',
		hint: 'El cliente elige una sola.',
		example: 'Talla: S, M o L',
		needsOptions: true,
	},
	multiseleccion: {
		label: 'Elige varias',
		hint: 'Puede marcar más de una.',
		example: 'Material: algodón y lino',
		needsOptions: true,
	},
	texto: {
		label: 'Texto',
		hint: 'Se escribe en cada producto.',
		example: 'Marca, composición',
		needsOptions: false,
	},
	numero: {
		label: 'Número',
		hint: 'Un número en cada producto.',
		example: 'Peso, centímetros',
		needsOptions: false,
	},
};

export function isAtributoTipo(value: unknown): value is AtributoTipo {
	return ATRIBUTO_TIPOS.includes(value as AtributoTipo);
}

export function needsOptions(tipo: AtributoTipo) {
	return TIPO_INFO[tipo].needsOptions;
}

export function resumenAtributo(item: Pick<Atributo, 'tipo' | 'opciones'>) {
	const info = TIPO_INFO[item.tipo];
	if (!info.needsOptions) return `${info.label} · se llena en el producto`;
	if (item.opciones.length === 0) return info.label;
	const preview = item.opciones
		.slice(0, 4)
		.map((opcion) => opcion.valor)
		.join(', ');
	const extra = item.opciones.length > 4 ? ` +${item.opciones.length - 4}` : '';
	return `${info.label} · ${preview}${extra}`;
}
