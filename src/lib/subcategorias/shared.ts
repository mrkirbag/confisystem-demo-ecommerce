export type Subcategoria = {
	id: string;
	categoria_id: string;
	categoria_nombre: string;
	categoria_slug: string;
	nombre: string;
	slug: string;
	imagen_url: string | null;
	orden: number;
	activo: boolean;
	productos: number;
};

export { initialsFromName, isValidSlug, slugify } from '../categorias/shared';
