import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

function requiredEnv(name: keyof ImportMetaEnv): string {
	const value = import.meta.env[name];
	if (!value) {
		throw new Error(`Falta la variable de entorno ${name}`);
	}
	return value;
}

export function getDb(): Client {
	if (!client) {
		client = createClient({
			url: requiredEnv('TURSO_DATABASE_URL'),
			authToken: requiredEnv('TURSO_AUTH_TOKEN'),
		});
	}
	return client;
}
