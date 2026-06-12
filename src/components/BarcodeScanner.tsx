'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Barcode, Loader2, Search, Camera, CheckCircle2 } from 'lucide-react';

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

    const calories = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0;
    const protein  = n['proteins_serving']       ?? n['proteins_100g']       ?? 0;
    const carbs    = n['carbohydrates_serving']  ?? n['carbohydrates_100g']  ?? 0;
    const fat      = n['fat_serving']            ?? n['fat_100g']            ?? 0;

    return {
        name: p.product_name || p.product_name_en || 'Unknown Product',
        calories: Math.round(calories),
        protein:  Math.round(protein  * 10) / 10,
        carbs:    Math.round(carbs    * 10) / 10,
        fat:      Math.round(fat      * 10) / 10,
        portion_estimate: servingSize,
    };
}

export function BarcodeScanner({ onResult, onClose }: Props) {
    const [barcode, setBarcode]   = useState('');
    const [loading, setLoading]   = useState(false);
    const [error,   setError]     = useState('');
    const [result,  setResult]    = useState<FoodResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef     = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

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
        if ('BarcodeDetector' in window) {
            try {
                const detector = new (window as any).BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
                });
                const bitmap   = await createImageBitmap(file);
                const barcodes = await detector.detect(bitmap);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    setBarcode(code);
                    handleLookup(code);
                    return;
                }
                setError('No barcode detected. Try typing the number below.');
            } catch {
                setError('Could not read the image. Try typing the number below.');
            }
        } else {
            setError('Auto-scan not supported on this device. Type the number below.');
        }
    }

    return (
        <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-subtle)] overflow-hidden animate-in slide-in-from-top-2">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: 'var(--color-navy)' }}>
                <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5" />
                    <span className="font-bold text-sm">Barcode Scanner</span>
                </div>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-3">
                {/* Camera button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl font-semibold text-sm transition-colors bg-[var(--color-surface-elevated)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(77,137,226,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = ''; }}
                >
                    <Camera className="w-4 h-4" />
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
                        ref={inputRef}
                        type="number"
                        inputMode="numeric"
                        placeholder="Or type barcode number…"
                        value={barcode}
                        onChange={e => setBarcode(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleLookup(barcode); }}
                        className="flex-1 px-3 py-2.5 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)] text-sm outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                        onBlur={e => { e.target.style.borderColor = ''; }}
                    />
                    <button
                        onClick={() => handleLookup(barcode)}
                        disabled={!barcode.trim() || loading}
                        className="px-4 py-2.5 text-white rounded-xl font-bold disabled:opacity-40 transition-colors"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                )}

                {/* Result */}
                {result && (
                    <div className="bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border-light)] p-3 space-y-3">
                        <div>
                            <p className="font-bold text-[var(--color-text)] text-sm">{result.name}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">per {result.portion_estimate}</p>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                            {[
                                { label: 'Cal',    value: result.calories,      color: 'text-orange-600' },
                                { label: 'Protein', value: `${result.protein}g`, color: 'text-blue-600'   },
                                { label: 'Carbs',  value: `${result.carbs}g`,   color: 'text-yellow-600' },
                                { label: 'Fat',    value: `${result.fat}g`,     color: 'text-purple-600' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="bg-[var(--color-bg-subtle)] rounded-lg py-1.5">
                                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                                    <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => { onResult(result); onClose(); }}
                            className="w-full py-2.5 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            <CheckCircle2 className="w-4 h-4" /> Add to Log
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
