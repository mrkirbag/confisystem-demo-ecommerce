export type AdminNavIcon =
	| 'catalogo'
	| 'categorias'
	| 'subcategorias'
	| 'atributos'
	| 'productos'
	| 'pedidos'
	| 'estadisticas'
	| 'configuracion'
	| 'tienda'
	| 'identidad'
	| 'usuarios';

export type AdminNavLeaf = {
	type: 'link';
	href: string;
	label: string;
	kicker: string;
	icon: AdminNavIcon;
};

export type AdminNavGroup = {
	type: 'group';
	id: string;
	label: string;
	icon: AdminNavIcon;
	children: AdminNavLeaf[];
};

export type AdminNavEntry = AdminNavLeaf | AdminNavGroup;

export const ADMIN_NAV: AdminNavEntry[] = [
	{
		type: 'group',
		id: 'catalogo',
		label: 'Catálogo',
		icon: 'catalogo',
		children: [
			{
				type: 'link',
				href: '/admin/catalogo/categorias',
				label: 'Categorías',
				kicker: 'Organización',
				icon: 'categorias',
			},
			{
				type: 'link',
				href: '/admin/catalogo/subcategorias',
				label: 'Subcategorías',
				kicker: 'Agrupación',
				icon: 'subcategorias',
			},
			{
				type: 'link',
				href: '/admin/catalogo/atributos',
				label: 'Atributos',
				kicker: 'Variantes',
				icon: 'atributos',
			},
			{
				type: 'link',
				href: '/admin/catalogo/productos',
				label: 'Productos',
				kicker: 'Inventario',
				icon: 'productos',
			},
		],
	},
	{
		type: 'link',
		href: '/admin/pedidos',
		label: 'Pedidos',
		kicker: 'Ventas',
		icon: 'pedidos',
	},
	{
		type: 'link',
		href: '/admin/estadisticas',
		label: 'Estadísticas',
		kicker: 'Reportes',
		icon: 'estadisticas',
	},
	{
		type: 'group',
		id: 'configuracion',
		label: 'Configuración',
		icon: 'configuracion',
		children: [
			{
				type: 'link',
				href: '/admin/configuracion/tienda',
				label: 'Tienda',
				kicker: 'Datos',
				icon: 'tienda',
			},
			{
				type: 'link',
				href: '/admin/configuracion/identidad-visual',
				label: 'Identidad Visual',
				kicker: 'Apariencia',
				icon: 'identidad',
			},
			{
				type: 'link',
				href: '/admin/configuracion/usuarios',
				label: 'Usuarios',
				kicker: 'Accesos',
				icon: 'usuarios',
			},
		],
	},
];

export function isNavActive(pathname: string, href: string) {
	if (href === '/admin') {
		return pathname === '/admin' || pathname === '/admin/';
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function isGroupActive(pathname: string, group: AdminNavGroup) {
	return group.children.some((child) => isNavActive(pathname, child.href));
}

export function getAdminNav(): AdminNavEntry[] {
	return ADMIN_NAV;
}
