import type { APIRoute } from 'astro';
import { listProductos } from '@/lib/productos';
import { listCategorias } from '@/lib/categorias';

export const prerender = false;

const SITE = 'https://confiservicio.com';

function esc(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
	try {
		const [productos, categorias] = await Promise.all([
			listProductos().catch(() => []),
			listCategorias().catch(() => []),
		]);

		const now = new Date().toISOString();

		// Páginas estáticas / principales
		const urls: Array<{ loc: string; lastmod?: string; changefreq: string; priority: string }> = [
			{
				loc: `${SITE}/`,
				lastmod: now,
				changefreq: 'daily',
				priority: '1.0',
			},
		];

		// Categorías como anclas o filtros
		categorias
			.filter((c) => c.activo)
			.forEach((c) => {
				urls.push({
					loc: `${SITE}/#${c.slug}`,
					changefreq: 'weekly',
					priority: '0.8',
				});
			});

		// Productos activos
		productos
			.filter((p) => p.activo)
			.forEach((p) => {
				urls.push({
					loc: `${SITE}/landing/${p.slug}`,
					lastmod: now,
					changefreq: 'weekly',
					priority: p.en_oferta || p.es_tendencia ? '0.9' : '0.8',
				});
			});

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
	)
	.join('\n')}
</urlset>`;

		return new Response(xml, {
			status: 200,
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, s-maxage=3600',
			},
		});
	} catch (err: any) {
		return new Response('Error generando sitemap', { status: 500 });
	}
};
