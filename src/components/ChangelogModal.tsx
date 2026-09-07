'use client';

import { X, Sparkles, Rocket, Zap, Bug, Dumbbell, Brain, Smartphone, Calendar, Bell, Sun, Moon, Dna, Apple, BarChart2, BookOpen, Watch, HeartPulse, Users, Pill, Gauge, Mic, FileText, Languages, Wand2 } from 'lucide-react';
import { Modal } from './ui/Modal';

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
    if (!isOpen) return null;

    const changes = [
        {
            version: "v2.4 — Kinetic Rebrand",
            date: "July 28, 2026",
            features: [
                { icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Life Logger is now Kinetic — new name, logo, and a floating nav with a one-tap capture button." },
                { icon: <Mic className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Native voice logging fixed on Android — it now actually captures your voice reliably." },
                { icon: <FileText className="w-4 h-4 text-[var(--color-success)]" />, text: "Menu Scanner accepts an uploaded PDF menu, not just a photo." },
            ]
        },
        {
            version: "v2.3 — Wear OS, Health Connect & Readiness",
            date: "July 19, 2026",
            features: [
                { icon: <Watch className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "New Wear OS companion app: voice logging, live guided workouts, and rings on your wrist." },
                { icon: <HeartPulse className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Health Connect sync (Android): sleep, steps, and resting heart rate — no manual entry." },
                { icon: <Gauge className="w-4 h-4 text-[var(--color-success)]" />, text: "Daily Readiness Score with a plain-language breakdown, plus progressive-overload weight suggestions." },
                { icon: <Pill className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Supplement & medication tracking with dose scheduling and reminders." },
            ]
        },
        {
            version: "v2.2 — AI Autopilot & Partners",
            date: "July 14, 2026",
            features: [
                { icon: <Brain className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "AI Coach can now build and schedule entire training and meal plans, not just log activity." },
                { icon: <Users className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Workout Partners: link up, share progress, send nudges, and run group challenges." },
                { icon: <Rocket className="w-4 h-4 text-[var(--color-success)]" />, text: "Progress photos now support picking from your gallery, not just the camera." },
            ]
        },
        {
            version: "v2.1 — Visual Refresh & Français",
            date: "June 11, 2026",
            features: [
                { icon: <Wand2 className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "New color palette, typography, and dashboard design — the first step toward Kinetic." },
                { icon: <Languages className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Full English/French language toggle, including AI coach responses." },
                { icon: <Zap className="w-4 h-4 text-[var(--color-success)]" />, text: "Connect your own Claude to your fitness data with a personal AI connector key." },
            ]
        },
        {
            version: "v2.0 — Native Apps & Calendar",
            date: "May 24, 2026",
            features: [
                { icon: <Smartphone className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "iOS and Android native apps published to the App Store and Play Store." },
                { icon: <Calendar className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Subscribe to your workout calendar in Apple Calendar or Google Calendar via a personal webcal:// link." },
                { icon: <Bell className="w-4 h-4 text-[var(--color-success)]" />, text: "Push notifications for scheduled workouts — configurable lead time (5 min to 1 day before)." },
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
                { icon: <BarChart2 className="w-4 h-4 text-[var(--color-success)]" />, text: "Program adherence dot grid and schedule calendar with color-coded session types." },
            ]
        },
        {
            version: "v1.4 — Health Integrations",
            date: "May 21, 2026",
            features: [
                { icon: <Dna className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Connect Strava, Withings, and Oura in Settings → Health Integrations." },
                { icon: <Apple className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Withings body-composition data (fat %, muscle mass) shown on Trends and Body tabs." },
                { icon: <Zap className="w-4 h-4 text-[var(--color-success)]" />, text: "lbs / kg unit preference saved to your profile and synced across devices." },
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
                { icon: <Rocket className="w-4 h-4 text-[var(--color-success)]" />, text: "Save meals and re-log them with one tap." },
                { icon: <Brain className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "AI Coach history persists across devices via Supabase." },
                { icon: <Moon className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Progress photos and full body-metrics history in the new Body tab." },
            ]
        },
        {
            version: "v1.1 — Workout Builder",
            date: "May 20, 2026",
            features: [
                { icon: <Dumbbell className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Workout builder with active session tracker and rest timer." },
                { icon: <Brain className="w-4 h-4 text-[var(--color-success)]" />, text: "AI Coach can build and save workouts from natural language." },
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
        <Modal isOpen onClose={onClose} aria-label="Changelog" size="lg" sheet={false} padding={false} className="overflow-hidden flex flex-col max-h-[80dvh]">

                <div className="p-6 text-white flex justify-between items-center" style={{ background: 'var(--color-navy)' }}>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            What&apos;s New
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

        </Modal>
    );
}
