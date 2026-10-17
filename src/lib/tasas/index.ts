/**
 * Sistema Multitasa y Switch de Monedas
 * Monedas soportadas: USD ($), VES (Bs.), COP (Pesos Colombianos)
 */

export type MonedaCodigo = 'USD' | 'VES' | 'COP';

export interface MonedaConfig {
	codigo: MonedaCodigo;
	simbolo: string;
	nombre: string;
	etiqueta: string;
}

export const MONEDAS: MonedaConfig[] = [
	{ codigo: 'USD', simbolo: '$', nombre: 'Dólares', etiqueta: 'USD ($)' },
	{ codigo: 'VES', simbolo: 'Bs.', nombre: 'Bolívares', etiqueta: 'Bs. (VES)' },
	{ codigo: 'COP', simbolo: 'COP', nombre: 'Pesos (COP)', etiqueta: 'COP ($)' },
];

export interface TasasCambio {
	tasa_bcv: number | null;
	tasa_cop: number | null;
}

export const CURRENCY_STORAGE_KEY = 'demo_tienda_moneda_activa';

export function formatPrecioConMoneda(
	valorUSD: number,
	moneda: MonedaCodigo = 'USD',
	tasas?: TasasCambio
): string {
	const base = Number(valorUSD) || 0;
	if (moneda === 'VES') {
		const tasa = Number(tasas?.tasa_bcv) || 1;
		const enBs = base * tasa;
		return (
			'Bs. ' +
			new Intl.NumberFormat('es-VE', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}).format(enBs)
		);
	}
	if (moneda === 'COP') {
		const tasa = Number(tasas?.tasa_cop) || 1;
		const enCop = Math.round(base * tasa);
		return (
			'$ ' +
			new Intl.NumberFormat('es-CO', {
				maximumFractionDigits: 0,
			}).format(enCop) +
			' COP'
		);
	}
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(base);
}

export function formatRangoConMoneda(
	minUSD: number,
	maxUSD: number,
	moneda: MonedaCodigo = 'USD',
	tasas?: TasasCambio
): string {
	if (!Number.isFinite(minUSD) || !Number.isFinite(maxUSD)) {
		return formatPrecioConMoneda(0, moneda, tasas);
	}
	if (minUSD === maxUSD) {
		return formatPrecioConMoneda(minUSD, moneda, tasas);
	}
	const menor = Math.min(minUSD, maxUSD);
	const mayor = Math.max(minUSD, maxUSD);
	return `${formatPrecioConMoneda(menor, moneda, tasas)} – ${formatPrecioConMoneda(mayor, moneda, tasas)}`;
}
