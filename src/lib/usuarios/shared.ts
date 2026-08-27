export type UsuarioAdmin = {
	id: string;
	nombre: string;
	correo: string;
	rol: string;
	activo: boolean;
	creado_en: string | null;
};

export function canManageUsers(admin: { id: string } | null | undefined) {
	return Boolean(admin);
}

export function formatFechaUsuario(value: string | null) {
	if (!value) return '—';
	const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString('es-VE', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

export function initialsFromName(nombre: string) {
	const parts = nombre.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return 'U';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
