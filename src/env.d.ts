/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly TURSO_DATABASE_URL: string;
	readonly TURSO_AUTH_TOKEN: string;
	readonly JWT_SECRET: string;
	readonly R2_ACCESS_KEY_ID?: string;
	readonly R2_SECRET_ACCESS_KEY?: string;
	readonly R2_REGION?: string;
	readonly S3_BUCKET?: string;
	readonly S3_ENDPOINT?: string;
	readonly S3_PUBLIC_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
	interface Locals {
		admin: {
			id: string;
			correo: string;
			nombre: string;
			rol: string;
		} | null;
	}
}
