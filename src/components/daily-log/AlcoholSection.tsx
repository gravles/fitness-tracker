'use client';

import { Plus, Minus } from 'lucide-react';

interface AlcoholSectionProps {
    alcohol: number;
    setAlcohol: (val: number) => void;
}

export function AlcoholSection({ alcohol, setAlcohol }: AlcoholSectionProps) {
    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-xl">🍺</span> Alcohol
            </h3>
            <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">Standard Drinks</span>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setAlcohol(Math.max(0, alcohol - 1))}
                        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-2xl font-bold w-8 text-center">{alcohol}</span>
                    <button
                        onClick={() => setAlcohol(alcohol + 1)}
                        className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 active:bg-blue-100"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
