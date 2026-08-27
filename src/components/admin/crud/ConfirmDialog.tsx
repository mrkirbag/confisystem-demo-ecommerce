import { useEffect, useRef } from 'react';

type Props = {
	open: boolean;
	title: string;
	text: string;
	confirmLabel?: string;
	busyLabel?: string;
	busy?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
};

export default function ConfirmDialog({
	open,
	title,
	text,
	confirmLabel = 'Eliminar',
	busyLabel = 'Eliminando…',
	busy = false,
	onCancel,
	onConfirm,
}: Props) {
	const ref = useRef<HTMLDialogElement>(null);
	const pressedBackdrop = useRef(false);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	function requestCancel() {
		if (!busy) onCancel();
	}

	return (
		<dialog
			ref={ref}
			className="admin-dialog"
			onCancel={(event) => {
				if (busy) event.preventDefault();
			}}
			onClose={() => {
				if (open) requestCancel();
			}}
			onPointerDown={(event) => {
				pressedBackdrop.current = event.target === ref.current;
			}}
			onClick={(event) => {
				if (pressedBackdrop.current && event.target === ref.current) requestCancel();
				pressedBackdrop.current = false;
			}}
		>
			<div
				className="admin-dialog__card"
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
			>
				<h2 className="admin-dialog__title">{title}</h2>
				<p className="admin-dialog__text">{text}</p>
				<div className="admin-dialog__actions">
					<button type="button" className="admin-btn admin-btn--ghost" onClick={requestCancel} disabled={busy}>
						Cancelar
					</button>
					<button type="button" className="admin-btn admin-btn--danger" onClick={onConfirm} disabled={busy}>
						{busy ? busyLabel : confirmLabel}
					</button>
				</div>
			</div>
		</dialog>
	);
}
