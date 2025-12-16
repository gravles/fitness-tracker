import { Dumbbell, Utensils, Scale } from 'lucide-react';

interface WeeklyStats {
    avgWeight: number;
    totalMovement: number;
    avgProtein: number;
    totalAlcohol: number;
}

export function WeeklySummary({ stats }: { stats: WeeklyStats }) {
    return (
        <div className="grid grid-cols-4 gap-2">
            <div className="glass-card p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                <Scale className="w-5 h-5 text-purple-500 mb-1" />
                <span className="text-xl font-bold text-gray-800">{stats.avgWeight > 0 ? stats.avgWeight : '--'}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Avg Lbs</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                <Dumbbell className="w-5 h-5 text-blue-500 mb-1" />
                <span className="text-xl font-bold text-gray-800">{stats.totalMovement}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Mins</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                <Utensils className="w-5 h-5 text-green-500 mb-1" />
                <span className="text-xl font-bold text-gray-800">{stats.avgProtein}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">g Prot</span>
            </div>
            <div className="glass-card p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                <span className="text-xl mb-1">🍺</span>
                <span className="text-xl font-bold text-gray-800">{stats.totalAlcohol}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Drinks</span>
            </div>
        </div>
    );
}
