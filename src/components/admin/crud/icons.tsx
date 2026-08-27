type IconProps = {
	className?: string;
};

export function IconPlus({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	);
}

export function IconSearch({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
			<path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	);
}

export function IconPencil({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="m4 20 4.5-1.1L19 8.4a1.6 1.6 0 0 0 0-2.3L17.9 5a1.6 1.6 0 0 0-2.3 0L5.1 15.5 4 20Z"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function IconTrash({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M5 7h14M10 11v6M14 11v6M8 7l1-2h6l1 2M7 7l1 13h8l1-13"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function IconEye({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
		</svg>
	);
}

export function IconEyeOff({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M4 5.5 19.5 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
			<path
				d="M9.2 9.4A3.5 3.5 0 0 0 12 15.5M14.7 14.2A3.5 3.5 0 0 0 9.8 9.4"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
			<path
				d="M6.4 7.6C4.2 9.1 2.8 12 2.8 12S6.2 17.5 12 17.5c1.6 0 3-.3 4.2-.8M17.3 15.6C19.6 14.1 21.2 12 21.2 12S17.8 6.5 12 6.5c-.6 0-1.1 0-1.7.1"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function IconX({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	);
}

export function IconImage({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<rect x="3.5" y="5" width="17" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
			<circle cx="9" cy="10.2" r="1.5" stroke="currentColor" strokeWidth="1.6" />
			<path
				d="M7.5 16.5 11 13l2.2 2.1 1.6-1.8 3.7 3.2"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function IconUpload({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M12 16V7m0 0 3.2 3.2M12 7 8.8 10.2"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path d="M5 16.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	);
}

export function IconChevron({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function IconWhatsApp({ className }: IconProps) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M12.1 3.6c-4.6 0-8.3 3.7-8.3 8.2 0 1.4.4 2.8 1 4L4 20.4l4.7-.9c1.2.6 2.5 1 3.9 1 4.6 0 8.3-3.7 8.3-8.3 0-4.5-3.7-8.2-8.8-8.2Z"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinejoin="round"
			/>
			<path
				d="M9.3 8.7c.2-.4.3-.4.6-.4h.5c.2 0 .4 0 .5.4.2.5.6 1.7.6 1.8 0 .2 0 .4-.2.5l-.4.5c-.1.1-.2.3 0 .6.2.3.8 1.3 1.8 2.1 1.1.9 2 1.2 2.3 1.3.3.1.5.1.7-.1l.5-.6c.2-.2.4-.2.6-.1.2 0 1.6.8 1.9.9.3.2.5.2.6.4.1.3.1 1.2-.3 1.8-.4.6-1.1.9-1.9.9-.5 0-1.1-.1-2.1-.5-1.7-.6-3.5-1.9-4.8-3.6-1.2-1.6-1.9-3.2-2.1-3.8-.3-.8-.1-1.4.2-1.8Z"
				fill="currentColor"
			/>
		</svg>
	);
}
