'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

interface FoodCameraProps {
    onCapture: (imageSrc: string) => void;
    onClose: () => void;
}

export function FoodCamera({ onCapture, onClose }: FoodCameraProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreview(result);
                // Automatically confirm for now, or add a "Use this photo" button
                onCapture(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={triggerFileSelect}>
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <div className="mt-2 text-center text-gray-500">
                <Camera className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-sm font-medium">Tap to Snap Data</p>
                <p className="text-xs">Take a photo of your meal</p>
            </div>
        </div>
    );
}
