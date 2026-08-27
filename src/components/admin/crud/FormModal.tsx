import { useEffect, useRef, type ReactNode } from 'react';
import { IconX } from './icons';

type Props = {
	open: boolean;
	title: string;
	kicker?: string;
	size?: 'form' | 'sheet' | 'preview';
	locked?: boolean;
	onClose: () => void;
	children: ReactNode;
};

export default function FormModal({
	open,
	title,
	kicker,
	size = 'form',
	locked = false,
	onClose,
	children,
}: Props) {
	const ref = useRef<HTMLDialogElement>(null);
	const pressedBackdrop = useRef(false);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog || !open) return;

		function onWheel(event: WheelEvent) {
			const target = event.target;
			if (!(target instanceof HTMLInputElement) || target.type !== 'number') return;
			event.preventDefault();
			const body = dialog.querySelector('.admin-dialog__body');
			if (body instanceof HTMLElement) body.scrollTop += event.deltaY;
		}

		dialog.addEventListener('wheel', onWheel, { passive: false });
		return () => dialog.removeEventListener('wheel', onWheel);
	}, [open]);

	function requestClose() {
		if (!locked) onClose();
	}

	return (
		<dialog
			ref={ref}
			className={`admin-dialog admin-dialog--${size}`}
			onCancel={(event) => {
				if (locked) event.preventDefault();
			}}
			onClose={() => {
				if (open) requestClose();
			}}
			onPointerDown={(event) => {
				pressedBackdrop.current = event.target === ref.current;
			}}
			onClick={(event) => {
				if (pressedBackdrop.current && event.target === ref.current) requestClose();
				pressedBackdrop.current = false;
			}}
		>
			<div
				className="admin-dialog__card"
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
			>
				<header className="admin-dialog__head">
					<div className="admin-dialog__heading">
						{kicker ? <p className="admin-dialog__kicker">{kicker}</p> : null}
						<h2 className="admin-dialog__title">{title}</h2>
					</div>
					<button
						type="button"
						className="admin-btn admin-btn--ghost admin-btn--icon"
						aria-label="Cerrar"
						onClick={requestClose}
						disabled={locked}
					>
						<IconX />
					</button>
				</header>
				<div className="admin-dialog__body">{children}</div>
			</div>
		</dialog>
	);
}
