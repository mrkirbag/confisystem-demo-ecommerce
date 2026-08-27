import { useEffect, useRef, useState } from 'react';
import { IconImage, IconUpload } from './icons';

type Props = {
	previewUrl: string | null;
	fileName?: string;
	disabled?: boolean;
	label?: string;
	hint?: string;
	compact?: boolean;
	onFile: (file: File) => void;
	onClear?: () => void;
};

export default function ImageUpload({
	previewUrl,
	fileName,
	disabled,
	label = 'Imagen',
	hint = 'JPG, PNG, WebP o AVIF · máx. 5 MB · 1 imagen',
	compact = false,
	onFile,
	onClear,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragover, setDragover] = useState(false);
	const [localUrl, setLocalUrl] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			if (localUrl) URL.revokeObjectURL(localUrl);
		};
	}, [localUrl]);

	const shown = localUrl || previewUrl;

	function applyFile(file: File) {
		if (localUrl) URL.revokeObjectURL(localUrl);
		setLocalUrl(URL.createObjectURL(file));
		onFile(file);
	}

	function clear() {
		if (localUrl) URL.revokeObjectURL(localUrl);
		setLocalUrl(null);
		if (inputRef.current) inputRef.current.value = '';
		onClear?.();
	}

	return (
		<div className={`admin-form__field${compact ? '' : ' admin-form__field--full'}`}>
			{label}
			<div
				className={`admin-upload${compact ? ' admin-upload--compact' : ''}${shown ? ' has-file' : ''}${dragover ? ' is-dragover' : ''}`}
				onDragOver={(event) => {
					event.preventDefault();
					if (!disabled) setDragover(true);
				}}
				onDragLeave={() => setDragover(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragover(false);
					if (disabled) return;
					const file = event.dataTransfer.files[0];
					if (file) applyFile(file);
				}}
			>
				<div className="admin-upload__preview">
					{shown ? (
						<img src={shown} alt="" />
					) : (
						<span className="admin-upload__placeholder">
							<IconImage />
						</span>
					)}
				</div>
				<div className="admin-upload__body">
					{compact ? null : (
						<p className="admin-upload__title">Arrastra una imagen o selecciónala</p>
					)}
					<p className="admin-upload__name">
						{fileName || (previewUrl ? 'Imagen actual' : compact ? 'Sin foto' : 'Ningún archivo seleccionado')}
					</p>
					<div className="admin-upload__cta-row">
						<label className="admin-btn admin-btn--ghost admin-upload__cta">
							<IconUpload />
							{compact ? 'Elegir' : 'Seleccionar imagen'}
							<input
								ref={inputRef}
								className="admin-upload__input"
								type="file"
								accept="image/jpeg,image/png,image/webp,image/avif"
								disabled={disabled}
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) applyFile(file);
								}}
							/>
						</label>
						{shown && onClear ? (
							<button
								type="button"
								className="admin-btn admin-btn--ghost"
								disabled={disabled}
								onClick={clear}
							>
								Quitar
							</button>
						) : null}
					</div>
					{compact ? null : <p className="admin-form__hint">{hint}</p>}
				</div>
			</div>
		</div>
	);
}
