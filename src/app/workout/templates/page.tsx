'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Dumbbell, Clock, Star, ChevronRight, Filter } from 'lucide-react';
import { WorkoutTemplate, WorkoutCategory, getPublicTemplates, getUserTemplates, useTemplate } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CATEGORIES: { value: WorkoutCategory | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '🏋️' },
    { value: 'strength', label: 'Strength', icon: '💪' },
    { value: 'cardio', label: 'Cardio', icon: '🏃' },
    { value: 'hiit', label: 'HIIT', icon: '🔥' },
    { value: 'flexibility', label: 'Flexibility', icon: '🧘' },
];

const DIFFICULTY_COLORS = {
    beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function TemplatesPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [userTemplates, setUserTemplates] = useState<WorkoutTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<WorkoutCategory | 'all'>('all');
    const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);

    useEffect(() => {
        loadTemplates();
    }, [category]);

    async function loadTemplates() {
        setLoading(true);
        try {
            const [publicData, userData] = await Promise.all([
                getPublicTemplates(category === 'all' ? undefined : category),
                getUserTemplates(),
            ]);
            setTemplates(publicData);
            setUserTemplates(userData);
        } catch (error) {
            console.error('Failed to load templates', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleUseTemplate(template: WorkoutTemplate) {
        haptics.success();
        try {
            await useTemplate(template.id);
            // Navigate to active workout tracker with template data
            router.push(`/workout/active/new?template=${template.id}`);
        } catch (error) {
            console.error('Failed to use template', error);
        }
    }

    return (
        <main className="min-h-screen bg-[var(--color-bg)] pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface-elevated)]">
                            <ChevronLeft className="w-5 h-5 text-[var(--color-text)]" />
                        </Link>
                        <h1 className="font-bold text-[var(--color-text)]">Workout Templates</h1>
                    </div>
                    <Link
                        href="/workout/builder"
                        className="text-sm font-bold px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg"
                    >
                        My Templates
                    </Link>
                </div>
            </header>

            {/* Category Filter */}
            <div className="max-w-md mx-auto px-4 py-4">
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.value}
                            onClick={() => {
                                haptics.tap();
                                setCategory(cat.value);
                            }}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${category === cat.value
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text)]'
                                }`}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 space-y-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : (
                    <>
                        {/* User's Templates */}
                        {userTemplates.length > 0 && (
                            <section>
                                <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                                    Your Templates
                                </h2>
                                <div className="space-y-3">
                                    {userTemplates.map((template) => (
                                        <TemplateCard
                                            key={template.id}
                                            template={template}
                                            onView={() => setSelectedTemplate(template)}
                                            onUse={() => handleUseTemplate(template)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Featured Templates */}
                        {templates.filter(t => t.is_featured).length > 0 && (
                            <section>
                                <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-yellow-500" />
                                    Featured
                                </h2>
                                <div className="space-y-3">
                                    {templates.filter(t => t.is_featured).map((template) => (
                                        <TemplateCard
                                            key={template.id}
                                            template={template}
                                            onView={() => setSelectedTemplate(template)}
                                            onUse={() => handleUseTemplate(template)}
                                            featured
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* All Templates */}
                        <section>
                            <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                                All Templates
                            </h2>
                            <div className="space-y-3">
                                {templates.filter(t => !t.is_featured).map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onView={() => setSelectedTemplate(template)}
                                        onUse={() => handleUseTemplate(template)}
                                    />
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>

            {/* Template Detail Modal */}
            {selectedTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md max-h-[80vh] shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg text-[var(--color-text)]">{selectedTemplate.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {selectedTemplate.difficulty && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[selectedTemplate.difficulty]}`}>
                                            {selectedTemplate.difficulty}
                                        </span>
                                    )}
                                    {selectedTemplate.estimated_duration && (
                                        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {selectedTemplate.estimated_duration} min
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="p-2 text-[var(--color-text-muted)]"
                            >
                                ✕
                            </button>
                        </div>

                        {selectedTemplate.description && (
                            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                                {selectedTemplate.description}
                            </p>
                        )}

                        <div className="flex-1 overflow-y-auto p-4">
                            <h4 className="text-sm font-bold text-[var(--color-text)] mb-3">Exercises</h4>
                            <div className="space-y-2">
                                {selectedTemplate.exercises.map((exercise, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 flex items-center justify-center bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-bold rounded-full">
                                                {idx + 1}
                                            </span>
                                            <span className="font-medium text-[var(--color-text)]">{exercise.name}</span>
                                        </div>
                                        <span className="text-sm text-[var(--color-text-muted)]">
                                            {exercise.sets} × {exercise.reps}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[var(--color-border)]">
                            <button
                                onClick={() => {
                                    handleUseTemplate(selectedTemplate);
                                    setSelectedTemplate(null);
                                }}
                                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                <Dumbbell className="w-5 h-5" />
                                Use This Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function TemplateCard({
    template,
    onView,
    onUse,
    featured = false
}: {
    template: WorkoutTemplate;
    onView: () => void;
    onUse: () => void;
    featured?: boolean;
}) {
    return (
        <div
            className={`p-4 rounded-2xl border transition-all ${featured
                ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-700'
                : 'bg-[var(--color-surface-elevated)] border-[var(--color-border)]'
                }`}
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-[var(--color-text)]">{template.name}</h3>
                    {template.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                            {template.description}
                        </p>
                    )}
                </div>
                {featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
            </div>

            <div className="flex items-center gap-3 mb-3">
                {template.difficulty && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[template.difficulty]}`}>
                        {template.difficulty}
                    </span>
                )}
                <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                    <Dumbbell className="w-3 h-3" />
                    {template.exercises.length} exercises
                </span>
                {template.estimated_duration && (
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.estimated_duration} min
                    </span>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onView}
                    className="flex-1 py-2 text-sm font-medium text-[var(--color-text)] bg-[var(--color-surface)] rounded-xl"
                >
                    View Details
                </button>
                <button
                    onClick={onUse}
                    className="flex-1 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-xl flex items-center justify-center gap-1"
                >
                    Use <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
