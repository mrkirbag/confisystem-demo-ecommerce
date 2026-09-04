import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));
const lib = (entry) => fileURLToPath(new URL(`./src/lib/${entry}`, import.meta.url));

export default defineConfig({
	output: 'server',
	adapter: netlify(),
	integrations: [react()],
	devToolbar: {
		enabled: false,
	},
	vite: {
		optimizeDeps: {
			include: ['react', 'react-dom', 'react/jsx-runtime'],
		},
		resolve: {
			alias: [
				{ find: '@/lib/tienda', replacement: lib('tienda/index.ts') },
				{ find: /^@\/lib\/usuarios$/, replacement: lib('usuarios/index.ts') },
				{ find: /^@\/lib\/categorias$/, replacement: lib('categorias/index.ts') },
				{ find: /^@\/lib\/subcategorias$/, replacement: lib('subcategorias/index.ts') },
				{ find: /^@\/lib\/atributos$/, replacement: lib('atributos/index.ts') },
				{ find: /^@\/lib\/productos$/, replacement: lib('productos/index.ts') },
				{ find: '@/lib/auditoria', replacement: lib('auditoria/index.ts') },
				{ find: '@/lib/auth', replacement: lib('auth/index.ts') },
				{ find: '@/lib/db', replacement: lib('db/index.ts') },
				{ find: '@/lib/r2', replacement: lib('r2/index.ts') },
				{ find: '@', replacement: src },
			],
		},
		ssr: {
			external: ['sharp', '@aws-sdk/client-s3'],
		},
	},
});
