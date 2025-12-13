import { CoachingTip } from '@/lib/smartCoach';
import { Lightbulb, Info, Flame, AlertCircle } from 'lucide-react';

export function SmartCoach({ tip }: { tip: CoachingTip | null }) {
    if (!tip) return null;

    const styles = {
        success: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200',
        warning: 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-orange-200',
        info: 'bg-white text-gray-800 border border-gray-100 shadow-sm'
    };

    const icons = {
        success: Flame,
        warning: AlertCircle,
        info: Lightbulb
    };

    const Icon = icons[tip.type] || Info;

    return (
        <div className={`p-5 rounded-2xl shadow-lg ${styles[tip.type]} relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}>
            <div className="relative z-10 flex gap-4 items-start">
                <div className={`p-2 rounded-full ${tip.type === 'info' ? 'bg-blue-50 text-blue-600' : 'bg-white/20 text-white'}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className={`font-bold text-lg ${tip.type === 'info' ? 'text-gray-900' : 'text-white'}`}>{tip.title}</h3>
                    <p className={`text-sm mt-1 ${tip.type === 'info' ? 'text-gray-500' : 'text-blue-50'}`}>{tip.message}</p>
                </div>
            </div>
        </div>
    );
}
