/**
 * Normaliza un número telefónico al formato numérico internacional estricto requerido por WhatsApp (E.164 sin signos).
 * Especialmente optimizado para números de Venezuela (+58) e internacionales.
 *
 * En dispositivos Apple (iOS, iPadOS, macOS / Safari), cuando una URL contiene un enlace como
 * https://wa.me/04247217176 (número local que empieza con 0 o sin código de país internacional),
 * la aplicación de WhatsApp lo interpreta como un nombre de usuario / handle (@04247217176) en lugar de un teléfono,
 * haciendo que el enlace falle y muestre el '@' inicial.
 *
 * WhatsApp exige que los números en wa.me vayan sin '+', sin ceros iniciales, sin espacios ni caracteres especiales.
 * Ejemplo correcto: https://wa.me/584247217176
 */
export function formatWhatsAppNumber(phone: string | null | undefined): string {
	if (!phone) return '';
	// Extraer únicamente los dígitos
	let digits = String(phone).replace(/\D/g, '');
	if (!digits) return '';

	// Quitar prefijo de marcado internacional '00' (ej. 0058...)
	if (digits.startsWith('00')) {
		digits = digits.slice(2);
	}

	// Caso Venezuela: Si guardaron con +58 pero mantuvieron el 0 del código de área (ej. 580414... longitud 12 o 13)
	if (digits.startsWith('580') && (digits.length === 12 || digits.length === 13)) {
		digits = '58' + digits.slice(3);
	}

	// Caso Venezuela: Número nacional de 11 dígitos que empieza por 0 (ej. 0414..., 0424..., 0412..., 0416..., 0426..., 0212...)
	if (digits.length === 11 && digits.startsWith('0')) {
		digits = '58' + digits.slice(1);
	}

	// Caso Venezuela: Número móvil de 10 dígitos sin el 0 inicial ni código internacional (ej. 4241234567, 414..., 412...)
	if (
		digits.length === 10 &&
		['414', '424', '412', '416', '426'].some((prefix) => digits.startsWith(prefix))
	) {
		digits = '58' + digits;
	}

	return digits;
}

/**
 * Genera una URL válida de WhatsApp (wa.me) con el número normalizado y el texto codificado.
 * Retorna null si el teléfono es nulo o inválido.
 */
export function buildWhatsAppLink(
	phone: string | null | undefined,
	text?: string | null,
): string | null {
	const cleanNumber = formatWhatsAppNumber(phone);
	if (!cleanNumber) return null;

	const baseUrl = `https://wa.me/${cleanNumber}`;
	if (!text) return baseUrl;

	return `${baseUrl}?text=${encodeURIComponent(text)}`;
}
