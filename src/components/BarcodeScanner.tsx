'use client';

import { useState, useRef } from 'react';
import { X, Barcode, Loader2, Search, Camera } from 'lucide-react';

interface FoodResult {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portion_estimate: string;
}

interface Props {
    onResult: (food: FoodResult) => void;
    onClose: () => void;
}

async function lookupBarcode(barcode: string): Promise<FoodResult | null> {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const n = p.nutriments || {};
    const servingSize = p.serving_size || '100g';

    // Prefer serving-size nutrients, fall back to per-100g
    const calories = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0;
    const protein = n['proteins_serving'] ?? n['proteins_100g'] ?? 0;
    const carbs = n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0;
    const fat = n['fat_serving'] ?? n['fat_100g'] ?? 0;

    return {
        name: p.product_name || p.product_name_en || 'Unknown Product',
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fat: Math.round(fat * 10) / 10,
        portion_estimate: servingSize
    };
}

export function BarcodeScanner({ onResult, onClose }: Props) {
    const [barcode, setBarcode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<FoodResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleLookup(code: string) {
        const trimmed = code.trim();
        if (!trimmed) return;
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const food = await lookupBarcode(trimmed);
            if (!food) {
                setError('Product not found. Try a different barcode or add manually.');
            } else {
                setResult(food);
            }
        } catch {
            setError('Network error. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleImageCapture(file: File) {
        // Use BarcodeDetector API if available (Chrome/Android)
        if ('BarcodeDetector' in window) {
            try {
                const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
                const bitmap = await createImageBitmap(file);
                const barcodes = await detector.detect(bitmap);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    setBarcode(code);
                    handleLookup(code);
                    return;
                }
                setError('No barcode detected in image. Try typing the number below.');
            } catch {
                setError('Could not read barcode from image. Try typing the number below.');
            }
        } else {
            setError('Auto-scan not supported on this device. Type the barcode number below.');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
            <div
                className="w-full bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Barcode className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-lg text-gray-900">Barcode Scanner</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Camera capture button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-green-200 rounded-2xl text-green-700 bg-green-50 hover:bg-green-100 transition-colors font-semibold"
                    >
                        <Camera className="w-5 h-5" />
                        Take Photo of Barcode
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleImageCapture(file);
                            e.target.value = '';
                        }}
                    />

                    {/* Manual entry */}
                    <div className="flex gap-2">
                        <input
                            type="number"
                            inputMode="numeric"
                            placeholder="Or type barcode number..."
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleLookup(barcode); }}
                            className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                            onClick={() => handleLookup(barcode)}
                            disabled={!barcode.trim() || loading}
                            className="px-4 py-3 bg-green-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-green-700 transition-colors"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                            <div>
                                <h4 className="font-bold text-gray-900">{result.name}</h4>
                                <p className="text-xs text-gray-400">per {result.portion_estimate}</p>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                {[
                                    { label: 'Cal', value: result.calories, color: 'text-orange-600' },
                                    { label: 'Protein', value: `${result.protein}g`, color: 'text-blue-600' },
                                    { label: 'Carbs', value: `${result.carbs}g`, color: 'text-yellow-600' },
                                    { label: 'Fat', value: `${result.fat}g`, color: 'text-purple-600' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-white rounded-xl py-2">
                                        <p className={`font-bold text-sm ${color}`}>{value}</p>
                                        <p className="text-[10px] text-gray-400">{label}</p>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => { onResult(result); onClose(); }}
                                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors"
                            >
                                Add to Log
                            </button>
                        </div>
                    )}

                    <p className="text-xs text-gray-400 text-center">
                        Powered by Open Food Facts — a free, open food database
                    </p>
                </div>

                <div className="h-4" />
            </div>
        </div>
    );
}
