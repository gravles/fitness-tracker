import { format, parse } from 'date-fns';
import { Activity } from 'lucide-react';

export function RecentLogs({ logs }: { logs: DailyLog[] }) {
    const recent = logs.slice(0, 3).reverse(); // Show last 3, newest first

    if (recent.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="font-bold text-gray-900 px-1">Recent Activity</h3>
            <div className="space-y-2">
                {recent.map(log => (
                    <div key={log.date} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${log.movement_completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-gray-800">{format(parse(log.date, 'yyyy-MM-dd', new Date()), 'EEEE')}</p>
                                <p className="text-xs text-gray-500">{log.movement_completed ? log.movement_type || 'Workout' : 'Rest Day'}</p>
                            </div>
                        </div>
                        {log.movement_duration && (
                            <span className="text-sm font-bold text-gray-900">{log.movement_duration}m</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
