'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2 } from 'lucide-react';

interface FoodCameraProps {
    onCapture: (imageSrc: string) => void;
    onClose: () => void;
    autoStart?: boolean;
}

/**
 * Resize and JPEG-compress an image data-URL so it's safe to send to the API.
 * Full camera shots can be 4–8 MB base64; we shrink to ≤1024 px and ~82% quality
 * which gives <200 KB for almost every meal photo — well within API limits.
 */
async function compressImage(dataUrl: string, maxPx = 1024, quality = 0.82): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            // Only resize if larger than maxPx
            if (width > maxPx || height > maxPx) {
                if (width >= height) {
                    height = Math.round((height / width) * maxPx);
                    width = maxPx;
                } else {
                    width = Math.round((width / height) * maxPx);
                    height = maxPx;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(dataUrl); return; }   // fallback: send as-is
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);           // fallback: send as-is
        img.src = dataUrl;
    });
}

export function FoodCamera({ onCapture, onClose, autoStart = false }: FoodCameraProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [compressing, setCompressing] = useState(false);

    useEffect(() => {
        if (autoStart) {
            // Best-effort auto-open. Works on Android; on iOS it requires a direct
            // tap but we still try — a 50 ms delay is enough for the DOM to settle.
            const id = setTimeout(() => fileInputRef.current?.click(), 50);
            return () => clearTimeout(id);
        }
    }, [autoStart]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCompressing(true);
        try {
            // Read the raw data URL
            const raw = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror   = reject;
                reader.readAsDataURL(file);
            });

            // Compress before calling onCapture — critical for large camera photos
            const compressed = await compressImage(raw);
            onCapture(compressed);
        } catch (err) {
            console.error('Image processing error:', err);
            // Last resort: read again without compression
            const reader = new FileReader();
            reader.onloadend = () => onCapture(reader.result as string);
            reader.readAsDataURL(file);
        } finally {
            setCompressing(false);
        }
    };

    return (
        <div
            className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-xl transition-colors"
            style={{ cursor: compressing ? 'default' : 'pointer', borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)' }}
            onMouseEnter={e => { if (!compressing) e.currentTarget.style.background = 'var(--color-bg-muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-subtle)'; }}
            onClick={() => !compressing && fileInputRef.current?.click()}
        >
            {/* No `capture` attribute — lets the OS show camera + gallery chooser,
                which is more reliable across iOS / Android / PWA than capture="environment" */}
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <div className="mt-2 text-center text-[var(--color-text-muted)]">
                {compressing ? (
                    <>
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        <p className="text-sm font-medium">Processing image…</p>
                        <p className="text-xs">Compressing for upload</p>
                    </>
                ) : (
                    <>
                        <Camera className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                        <p className="text-sm font-medium">Tap to Snap Data</p>
                        <p className="text-xs">Take a photo or choose from gallery</p>
                    </>
                )}
            </div>
        </div>
    );
}
