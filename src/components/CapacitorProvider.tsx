'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * CapacitorProvider
 *
 * Mounts once at app root. On native platforms it:
 *  - Hides the splash screen after the React tree renders
 *  - Registers for push notifications and saves the FCM/APNs token
 *  - Listens for push notification taps and navigates to the right screen
 *  - Handles deep links for Supabase auth callbacks (OTP magic links, future OAuth)
 *  - Manages the Android hardware back button
 *
 * On web this component is a transparent pass-through with zero side effects.
 */
export function CapacitorProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const cap = (window as any).Capacitor;
        if (!cap?.isNativePlatform?.()) return;

        const cleanups: Array<() => void> = [];

        async function init() {
            const [
                { SplashScreen },
                { App },
                { PushNotifications },
            ] = await Promise.all([
                import('@capacitor/splash-screen'),
                import('@capacitor/app'),
                import('@capacitor/push-notifications'),
            ]);

            // ── Splash screen ────────────────────────────────────────────────
            await SplashScreen.hide({ fadeOutDuration: 300 });

            // ── Push notifications ───────────────────────────────────────────
            // Request permission (iOS shows system prompt; Android auto-grants on 12-)
            const perm = await PushNotifications.requestPermissions();
            if (perm.receive === 'granted') {
                await PushNotifications.register();
            }

            // Registration event — we receive the FCM / APNs token
            const regListener = await PushNotifications.addListener(
                'registration',
                async ({ value: token }) => {
                    try {
                        const platform = cap.getPlatform() as 'ios' | 'android';
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) return;
                        await fetch('/api/notifications/register-device', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({ token, platform }),
                        });
                    } catch (e) {
                        console.error('[Capacitor] Failed to register device token', e);
                    }
                }
            );
            cleanups.push(() => regListener.remove());

            // Notification tap — navigate to the screen indicated in notification data
            const tapListener = await PushNotifications.addListener(
                'pushNotificationActionPerformed',
                ({ notification }) => {
                    const url = notification.data?.url as string | undefined;
                    if (url) router.push(url);
                }
            );
            cleanups.push(() => tapListener.remove());

            // ── Deep links ───────────────────────────────────────────────────
            // Handles Supabase OTP magic links and any future OAuth callbacks.
            // The URL scheme is configured in capacitor.config.ts as the app bundle ID.
            const urlListener = await App.addListener('appUrlOpen', async ({ url }) => {
                if (!url.includes('login-callback') && !url.includes('auth/callback')) return;

                // Normalise the custom-scheme URL so the URL constructor can parse it
                const parsed = new URL(url.replace(/^[a-z.]+:\/\//, 'https://x/'));

                // PKCE / OTP token_hash flow
                const tokenHash = parsed.searchParams.get('token_hash');
                const type      = parsed.searchParams.get('type') as any;
                if (tokenHash && type) {
                    await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
                    return;
                }

                // Implicit flow (access_token in hash fragment)
                const hashParams   = new URLSearchParams(parsed.hash.slice(1));
                const accessToken  = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                if (accessToken && refreshToken) {
                    await supabase.auth.setSession({
                        access_token:  accessToken,
                        refresh_token: refreshToken,
                    });
                }
            });
            cleanups.push(() => urlListener.remove());

            // ── Android back button ──────────────────────────────────────────
            // Navigate back through history; exit the app if at the root.
            const backListener = await App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    App.exitApp();
                }
            });
            cleanups.push(() => backListener.remove());
        }

        init().catch((e) => console.error('[CapacitorProvider] init error', e));

        return () => cleanups.forEach((fn) => fn());
    }, [router]);

    return <>{children}</>;
}
