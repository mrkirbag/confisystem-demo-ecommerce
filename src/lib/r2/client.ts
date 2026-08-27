import {
	CopyObjectCommand,
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getR2Env } from './env';

let client: S3Client | null = null;

export function getR2(): S3Client {
	if (client) return client;

	const env = getR2Env();
	client = new S3Client({
		region: env.region,
		endpoint: env.endpoint,
		credentials: {
			accessKeyId: env.accessKeyId,
			secretAccessKey: env.secretAccessKey,
		},
		forcePathStyle: true,
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
	});

	return client;
}

export async function putObject(params: {
	key: string;
	body: Buffer | Uint8Array;
	contentType: string;
}) {
	const env = getR2Env();
	await getR2().send(
		new PutObjectCommand({
			Bucket: env.bucket,
			Key: params.key,
			Body: params.body,
			ContentType: params.contentType,
			CacheControl: 'public, max-age=31536000, immutable',
		}),
	);
}

export async function deleteObject(key: string) {
	const env = getR2Env();
	await getR2().send(
		new DeleteObjectCommand({
			Bucket: env.bucket,
			Key: key,
		}),
	);
}

export async function copyObject(fromKey: string, toKey: string) {
	if (fromKey === toKey) return;
	const env = getR2Env();
	const source = `${env.bucket}/${fromKey.split('/').map(encodeURIComponent).join('/')}`;

	await getR2().send(
		new CopyObjectCommand({
			Bucket: env.bucket,
			CopySource: source,
			Key: toKey,
			CacheControl: 'public, max-age=31536000, immutable',
			MetadataDirective: 'REPLACE',
			ContentType: 'image/webp',
		}),
	);
}
