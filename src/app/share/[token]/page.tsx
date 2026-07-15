import { getSharedAchievement } from '@/lib/features';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Trophy, BicepsFlexed, Flame, Target, Star, type LucideIcon } from 'lucide-react';

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
    const { token } = await params;
    const achievement = await getSharedAchievement(token);

    if (!achievement) {
        notFound();
    }

    const data = achievement.achievement_data as {
        title: string;
        subtitle?: string;
        emoji?: string;
        stats?: { label: string; value: string | number }[];
    };

    const typeIcons: Record<string, LucideIcon> = {
        badge: Trophy,
        pr: BicepsFlexed,
        streak: Flame,
        goal: Target,
        level: Star,
    };
    const TypeIcon = typeIcons[achievement.achievement_type] ?? Trophy;

    return (
        <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #060a13 0%, #101a2c 100%)' }}>
            <div className="w-full max-w-sm">
                {/* Achievement Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(224,179,90,0.14)' }}>
                            <TypeIcon className="w-10 h-10" style={{ color: '#9c7426' }} aria-hidden="true" />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 mb-2">
                            {data.title}
                        </h1>
                        {data.subtitle && (
                            <p className="text-gray-600 mb-4">{data.subtitle}</p>
                        )}

                        {data.stats && data.stats.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 mt-6">
                                {data.stats.map((stat, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                                        <p className="text-xs text-gray-500">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
                        <p className="text-center text-sm text-gray-500">
                            Achieved on {format(parseISO(achievement.created_at), 'MMMM d, yyyy')}
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="mt-6 text-center">
                    <p className="text-white/80 text-sm mb-3">
                        Track your own fitness journey
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-shadow"
                        style={{ background: '#e0b35a', color: '#060a13' }}
                    >
                        Get Started Free
                    </a>
                </div>

                {/* View count */}
                <p className="text-center text-white/80 text-xs mt-6">
                    {achievement.view_count} views
                </p>
            </div>
        </main>
    );
}

// Generate metadata for social sharing
export async function generateMetadata({ params }: PageProps) {
    const { token } = await params;
    const achievement = await getSharedAchievement(token);

    if (!achievement) {
        return {
            title: 'Achievement Not Found',
        };
    }

    const data = achievement.achievement_data as { title: string; subtitle?: string };

    return {
        title: `${data.title} | Life Logger`,
        description: data.subtitle || 'Check out this fitness achievement!',
        openGraph: {
            title: data.title,
            description: data.subtitle || 'Check out this fitness achievement!',
            type: 'website',
        },
        twitter: {
            card: 'summary',
            title: data.title,
            description: data.subtitle || 'Check out this fitness achievement!',
        },
    };
}
