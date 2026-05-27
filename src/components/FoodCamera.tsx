'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, ImageIcon, Loader2 } from 'lucide-react';

interface FoodCameraProps {
    onCapture: (imageSrc: string) => void;
    onClose: () => void;
    autoStart?: boolean;
}

/**
 * Resize + JPEG-compress a data URL so it's safe to send to the API.
 * Full camera shots can be 4–8 MB base64; we shrink to ≤1024 px / 82% quality
 * which gives <200 KB for almost any meal photo.
 */
async function compressImage(dataUrl: string, maxPx = 1024, quality = 0.82): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
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
            if (!ctx) { resolve(dataUrl); return; }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

export function FoodCamera({ onCapture, onClose, autoStart = false }: FoodCameraProps) {
    // Two separate inputs: one forces the camera, one opens the gallery
    const cameraInputRef  = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [compressing, setCompressing] = useState(false);

    useEffect(() => {
        if (autoStart) {
            // Auto-open the camera on mount (best-effort; iOS may require a tap)
            const id = setTimeout(() => cameraInputRef.current?.click(), 50);
            return () => clearTimeout(id);
        }
    }, [autoStart]);

    const processFile = async (file: File) => {
        setCompressing(true);
        try {
            const raw = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror   = reject;
                reader.readAsDataURL(file);
            });
            const compressed = await compressImage(raw);
            onCapture(compressed);
        } catch (err) {
            console.error('Image processing error:', err);
            // Fallback: send the original without compression
            const reader = new FileReader();
            reader.onloadend = () => onCapture(reader.result as string);
            reader.readAsDataURL(file);
        } finally {
            setCompressing(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        // Reset so the same file can be re-selected if needed
        e.target.value = '';
    };

    if (compressing) {
        return (
            <div
                className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)' }}
            >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Processing image…</p>
            </div>
        );
    }

    return (
        <div className="flex gap-3">
            {/* ── Take Photo (forces camera on iOS & Android) ── */}
            <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed transition-all active:scale-[0.97]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-subtle)'; }}
            >
                <Camera className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs font-bold">Take Photo</span>
            </button>

            {/* ── Choose from Gallery ── */}
            <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed transition-all active:scale-[0.97]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-subtle)'; }}
            >
                <ImageIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs font-bold">Gallery</span>
            </button>

            {/* Hidden inputs */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleChange}
            />
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
            />
        </div>
    );
}
