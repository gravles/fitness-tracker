'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';

export function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [otp, setOtp] = useState('');

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({ email });
        setLoading(false);
        if (error) {
            alert(error.message);
        } else {
            setSent(true);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email',
        });
        setLoading(false);
        if (error) {
            alert(error.message);
        }
    };

    if (sent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh p-6">
                {/* Subtle background glow */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 65%)' }}
                />

                <div className="w-full max-w-xs relative">
                    {/* Icon */}
                    <div className="flex flex-col items-center mb-8">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                            style={{
                                background: 'var(--color-gold-muted)',
                                border: '1px solid rgba(201,168,76,0.25)',
                            }}
                        >
                            <Mail className="w-6 h-6" style={{ color: 'var(--color-gold)' }} />
                        </div>

                        <h1
                            className="text-3xl font-bold text-[var(--color-text)] text-center"
                            style={{ fontFamily: 'var(--font-display)' }}
                        >
                            Check your email
                        </h1>

                        <div className="gold-rule w-12 mt-3 mb-4" />

                        <p className="text-[var(--color-text-muted)] text-sm text-center leading-relaxed">
                            We sent an 8-digit code to{' '}
                            <span className="text-[var(--color-text)] font-medium">{email}</span>
                        </p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            required
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            className="w-full px-4 py-4 rounded-xl text-center text-3xl font-mono tracking-[0.6em] transition-all outline-none placeholder:tracking-normal"
                            style={{
                                background: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.borderColor = 'var(--color-gold)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                            placeholder="00000000"
                            maxLength={8}
                            autoFocus
                        />

                        <button
                            type="submit"
                            disabled={loading || otp.length < 8}
                            className="w-full font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: 'var(--color-gold)',
                                color: 'var(--color-navy)',
                            }}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Code'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSent(false); setOtp(''); }}
                            className="w-full text-sm transition-colors flex items-center justify-center gap-2 py-2.5"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Use a different email
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-dvh p-6 relative overflow-hidden">
            {/* Subtle background glow */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(29,95,168,0.08) 0%, transparent 60%)' }}
            />

            <div className="w-full max-w-xs relative">
                {/* Wordmark */}
                <div className="mb-10 text-center">
                    <div
                        className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
                        style={{
                            background: 'var(--color-gold-muted)',
                            border: '1px solid rgba(201,168,76,0.25)',
                        }}
                    >
                        <span
                            className="text-xl font-bold"
                            style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}
                        >
                            L
                        </span>
                    </div>

                    <h1
                        className="text-4xl font-bold text-[var(--color-text)]"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        Life Logger
                    </h1>

                    <div className="gold-rule w-12 mt-3 mb-1 mx-auto" />

                    <p className="text-[var(--color-text-muted)] text-sm mt-3">
                        Track your days, simply.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSignIn} className="space-y-3">
                    <div>
                        <label
                            className="block text-[10px] font-bold tracking-widest uppercase mb-2"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            Email address
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl transition-all outline-none"
                            style={{
                                background: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.borderColor = 'var(--color-gold)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                            placeholder="you@example.com"
                            autoComplete="email"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--color-gold)',
                            color: 'var(--color-navy)',
                        }}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue with Email'}
                    </button>
                </form>

                <p className="text-center text-xs mt-8" style={{ color: 'var(--color-text-muted)' }}>
                    We'll send an 8-digit code to your inbox.
                </p>
            </div>
        </div>
    );
}
