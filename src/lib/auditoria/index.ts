import { randomUUID } from 'node:crypto';
import { getDb } from '../db';

export type ActorAuditoria = {
	id: string;
	nombre: string;
	correo: string;
};

type AuditoriaInput = {
	usuarioId: string;
	entidad: string;
	entidadId: string;
	accion: 'crear' | 'actualizar' | 'eliminar' | string;
	cambios?: unknown;
	actor?: ActorAuditoria;
};

export function cambiosAuditoria(actor: ActorAuditoria, extra: Record<string, unknown> = {}) {
	return {
		actor: {
			id: actor.id,
			nombre: actor.nombre,
			correo: actor.correo,
		},
		...extra,
	};
}

export async function registrarAuditoria(input: AuditoriaInput) {
	try {
		const db = getDb();
		const cambios = input.actor
			? cambiosAuditoria(input.actor, (input.cambios as Record<string, unknown> | undefined) ?? {})
			: input.cambios;

		await db.execute({
			sql: `
				INSERT INTO bitacora_auditoria (
					id, usuario_id, entidad_afectada, entidad_id, accion, cambios_json
				) VALUES (?, ?, ?, ?, ?, ?)
			`,
			args: [
				randomUUID(),
				input.usuarioId,
				input.entidad,
				input.entidadId,
				input.accion,
				cambios ? JSON.stringify(cambios) : null,
			],
		});
	} catch (error) {
		console.error('No se pudo registrar auditoría:', error);
	}
}
