import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy — FitnessTracker & AI Coach',
    description: 'How FitnessTracker & AI Coach handles your data.',
};

/**
 * Public privacy policy (no login required — Play Store reviewers and the
 * Health Connect declaration link here). Written to match what the app
 * actually does; update it when data handling changes.
 */
export default function PrivacyPage() {
    return (
        <main
            className="max-w-2xl mx-auto px-6 py-12 space-y-8"
            style={{ color: 'var(--color-text)' }}
        >
            <header className="space-y-2">
                <h1 className="text-2xl font-bold">Privacy Policy</h1>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    FitnessTracker &amp; AI Coach · Effective July 19, 2026
                </p>
            </header>

            <Section title="The short version">
                <p>
                    This is a personal fitness tracker. Your data exists to power <em>your</em> tracking,
                    readiness score, and coaching — nothing else. We don&apos;t sell it, we don&apos;t show ads,
                    and we don&apos;t share it with anyone except the service providers needed to run the app.
                </p>
            </Section>

            <Section title="What we collect">
                <ul className="list-disc pl-5 space-y-1">
                    <li>Account: your email address (used for sign-in codes).</li>
                    <li>Nutrition: meals and foods you log, calories and macros.</li>
                    <li>Workouts: exercises, sets, reps, weights, duration, and heart rate during sessions.</li>
                    <li>Body metrics: weight, measurements, and progress photos you choose to upload.</li>
                    <li>Daily wellness: your sleep-quality, energy, and stress ratings, and alcohol intake.</li>
                    <li>
                        Device health data, only if you connect it: sleep sessions, daily step counts, and
                        resting heart rate via Android&apos;s Health Connect (typically originating from your
                        watch through Samsung Health), and data from integrations you link yourself
                        (Strava, Oura, Withings).
                    </li>
                </ul>
            </Section>

            <Section title="Health Connect">
                <p>
                    If you grant Health Connect permissions, the app reads sleep sessions, steps, and resting
                    heart rate and stores them in your account to compute your readiness score and trends.
                    Use of this data complies with Google&apos;s Health Connect permissions policy, including the
                    Limited Use requirements: it is used solely to provide the app&apos;s user-facing health and
                    fitness features, is never used for advertising, and is never sold or transferred to third
                    parties for their own purposes. You can revoke access at any time in Health Connect
                    settings, which stops all future reads.
                </p>
            </Section>

            <Section title="AI features">
                <p>
                    When you use voice or photo logging and the AI coach, the relevant content (for example a
                    food description, a speech transcript, or your recent logs for coaching context) is
                    processed by Anthropic&apos;s Claude API to generate the result. This processing powers the
                    feature you invoked; it is not used for advertising.
                </p>
            </Section>

            <Section title="Where your data lives">
                <p>
                    Data is stored in a Supabase (PostgreSQL) database, encrypted in transit, with row-level
                    security so each account can only ever access its own records. Sharing features (workout
                    partners, challenges) share only what you explicitly choose to share, with the specific
                    people you choose.
                </p>
            </Section>

            <Section title="Deletion & your choices">
                <ul className="list-disc pl-5 space-y-1">
                    <li>You can edit or delete individual logs, photos, and records in the app.</li>
                    <li>Disconnect any integration (Health Connect, Strava, Oura, Withings) at any time.</li>
                    <li>
                        To delete your account and all associated data, email{' '}
                        <a href="mailto:nathandavie@gmail.com" style={{ color: 'var(--color-primary)' }}>
                            nathandavie@gmail.com
                        </a>{' '}
                        — deletion is completed within 30 days.
                    </li>
                </ul>
            </Section>

            <Section title="Changes & contact">
                <p>
                    If data handling changes, this page will be updated before the change takes effect.
                    Questions:{' '}
                    <a href="mailto:nathandavie@gmail.com" style={{ color: 'var(--color-primary)' }}>
                        nathandavie@gmail.com
                    </a>
                    .
                </p>
            </Section>
        </main>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="text-lg font-bold">{title}</h2>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {children}
            </div>
        </section>
    );
}
