import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(process.cwd(), '.env') });

export class R2Error extends Error {
	readonly status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = 'R2Error';
		this.status = status;
	}
}

export type R2Env = {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	bucket: string;
	endpoint: string;
	publicUrl: string;
};

function firstValue(...values: Array<string | undefined>): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return undefined;
}

function required(name: string, ...values: Array<string | undefined>): string {
	const value = firstValue(...values);
	if (!value) {
		throw new R2Error(`Falta la variable de entorno ${name}`, 500);
	}
	return value;
}

/** R2 S3 API is origin-only. A path like /bucket makes PutObject save under {bucket}/{key}. */
function originOnly(value: string): string {
	return new URL(value).origin;
}

function stripBucketPath(value: string, bucket: string): string {
	const url = new URL(value);
	const path = url.pathname.replace(/\/$/, '');
	if (path === `/${bucket}`) {
		return url.origin;
	}
	return `${url.origin}${path === '/' ? '' : path}`.replace(/\/$/, '');
}

let cached: R2Env | null = null;

export function getR2Env(): R2Env {
	if (cached) return cached;

	const bucket = required('S3_BUCKET', import.meta.env.S3_BUCKET, process.env.S3_BUCKET);

	cached = {
		accessKeyId: required(
			'AWS_ACCESS_KEY_ID',
			import.meta.env.AWS_ACCESS_KEY_ID,
			process.env.AWS_ACCESS_KEY_ID,
		),
		secretAccessKey: required(
			'AWS_SECRET_ACCESS_KEY',
			import.meta.env.AWS_SECRET_ACCESS_KEY,
			process.env.AWS_SECRET_ACCESS_KEY,
		),
		region:
			firstValue(import.meta.env.AWS_REGION, process.env.AWS_REGION) || 'auto',
		bucket,
		endpoint: originOnly(
			required('S3_ENDPOINT', import.meta.env.S3_ENDPOINT, process.env.S3_ENDPOINT),
		),
		publicUrl: stripBucketPath(
			required('S3_PUBLIC_URL', import.meta.env.S3_PUBLIC_URL, process.env.S3_PUBLIC_URL),
			bucket,
		),
	};

	return cached;
}
