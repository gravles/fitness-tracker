'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';

interface FoodCameraProps {
    onCapture: (imageSrc: string) => void;
    onClose: () => void;
    autoStart?: boolean;
}

export function FoodCamera({ onCapture, onClose, autoStart = false }: FoodCameraProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (autoStart) {
            setTimeout(() => {
                fileInputRef.current?.click();
            }, 100);
        }
    }, [autoStart]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreview(result);
                onCapture(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    return (
        <div
            className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-subtle)'; }}
            onClick={triggerFileSelect}
        >
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <div className="mt-2 text-center text-[var(--color-text-muted)]">
                <Camera className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                <p className="text-sm font-medium">Tap to Snap Data</p>
                <p className="text-xs">Take a photo of your meal</p>
            </div>
        </div>
    );
}
