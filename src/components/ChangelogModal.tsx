'use client';

import { X, Sparkles, Rocket, Zap, Bug, Dumbbell, Brain, Smartphone, Calendar, Bell, Sun, Moon, Dna, Apple, BarChart2, BookOpen, Languages, Plug, Save, Trash2 } from 'lucide-react';

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
    if (!isOpen) return null;

    const changes = [
        {
            version: "v2.1 — Language, MCP Connector & Workout Autosave",
            date: "June 8, 2026",
            features: [
                { icon: <Languages className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "English / French toggle in Settings — all UI and AI responses honour your choice." },
                { icon: <Plug className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Claude AI Connector: generate a key in Settings and use Life Logger as an MCP tool inside Claude.ai." },
                { icon: <Save className="w-4 h-4 text-green-500" />, text: "Workout autosave: every set writes to the DB immediately; reopen any past workout to edit sets." },
                { icon: <Trash2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Delete individual set rows in the workout logger with the × button." },
                { icon: <Bug className="w-4 h-4 text-[var(--color-text-muted)]" />, text: "iOS push notifications fixed; food camera restored with gallery picker; AI weekly analysis reliability improved." },
            ]
        },
        {
            version: "v2.0 — Native Apps & Calendar",
            date: "May 24, 2026",
            features: [
                { icon: <Smartphone className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "iOS and Android native apps published to the App Store and Play Store." },
                { icon: <Calendar className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Subscribe to your workout calendar in Apple Calendar or Google Calendar via a personal webcal:// link." },
                { icon: <Bell className="w-4 h-4 text-green-500" />, text: "Push notifications for scheduled workouts — configurable lead time (5 min to 1 day before)." },
                { icon: <Sun className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Light / System / Dark theme toggle in Settings." },
                { icon: <Rocket className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Onboarding flow for new users: name, birthday, height, weight, and fitness goal." },
            ]
        },
        {
            version: "v1.5 — 12-Week Programs",
            date: "May 22, 2026",
            features: [
                { icon: <BookOpen className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "AI generates a full periodised 12-week training plan tailored to your goal and equipment." },
                { icon: <Dumbbell className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Workout logger pre-loads target weights from your 1RM; notifies you of new PRs." },
                { icon: <BarChart2 className="w-4 h-4 text-green-500" />, text: "Program adherence dot grid and schedule calendar with color-coded session types." },
            ]
        },
        {
            version: "v1.4 — Health Integrations",
            date: "May 21, 2026",
            features: [
                { icon: <Dna className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Connect Strava, Withings, and Oura in Settings → Health Integrations." },
                { icon: <Apple className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Withings body-composition data (fat %, muscle mass) shown on Trends and Body tabs." },
                { icon: <Zap className="w-4 h-4 text-green-500" />, text: "lbs / kg unit preference saved to your profile and synced across devices." },
            ]
        },
        {
            version: "v1.3 — AI Nutrition Planner",
            date: "May 21, 2026",
            features: [
                { icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "AI-powered meal plan generation using your pantry and prep-time constraints." },
                { icon: <Brain className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Pantry management with macro tracking; populate via photo scan or voice." },
            ]
        },
        {
            version: "v1.2 — Saved Meals & Coach Memory",
            date: "May 21, 2026",
            features: [
                { icon: <Rocket className="w-4 h-4 text-green-500" />, text: "Save meals and re-log them with one tap." },
                { icon: <Brain className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "AI Coach history persists across devices via Supabase." },
                { icon: <Moon className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Progress photos and full body-metrics history in the new Body tab." },
            ]
        },
        {
            version: "v1.1 — Workout Builder",
            date: "May 20, 2026",
            features: [
                { icon: <Dumbbell className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Workout builder with active session tracker and rest timer." },
                { icon: <Brain className="w-4 h-4 text-green-500" />, text: "AI Coach can build and save workouts from natural language." },
                { icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "AI Weekly Insights with trends across nutrition, movement, and alcohol." },
            ]
        },
        {
            version: "v1.0 — Initial Release",
            date: "May 19, 2026",
            features: [
                { icon: <Bug className="w-4 h-4 text-[var(--color-text-muted)]" />, text: "Core tracking: food diary, workouts, sleep, habits, and streaks." },
                { icon: <Zap className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "XP, levels, badges, and shareable achievement cards." },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-10">
            <div className="bg-[var(--color-surface-elevated)] rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">

                <div className="p-6 text-white flex justify-between items-center" style={{ background: 'var(--color-navy)' }}>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            🚀 What&apos;s New
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-gold)' }}>Changelog &amp; Updates</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    {changes.map((release, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-[var(--color-border-light)]">
                            <div
                                className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2"
                                style={{ background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                            />
                            <div className="mb-2">
                                <h3 className="font-bold text-[var(--color-text)] text-lg">{release.version}</h3>
                                <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">{release.date}</p>
                            </div>
                            <ul className="space-y-3">
                                {release.features.map((feat, j) => (
                                    <li key={j} className="flex gap-3 text-sm text-[var(--color-text-muted)]">
                                        <div className="mt-0.5 shrink-0">{feat.icon}</div>
                                        {feat.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-[var(--color-bg-subtle)] border-t border-[var(--color-border-light)]">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}
