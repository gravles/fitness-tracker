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
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin }
        });
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
        // Success is handled by AuthWrapper's onAuthStateChange listener
    };

    if (sent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6">
                <div className="w-full max-w-sm text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                        <Mail className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Check your email</h1>
                    <p className="text-gray-500 mb-8">
                        We sent a code to <span className="font-semibold text-gray-900">{email}</span>.
                        Enter it below to sign in.
                    </p>

                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                required
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-center text-3xl font-mono tracking-[0.5em] placeholder:tracking-normal"
                                placeholder="000000"
                                maxLength={8}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otp.length < 6}
                            className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-medium hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Code'}
                        </button>

                        <div className="pt-4 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => setSent(false)}
                                className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Use a different email
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <div className="w-full max-w-sm">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Life Logger</h1>
                    <p className="text-gray-500 mt-2">Track your days, simply.</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            placeholder="you@example.com"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-medium hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
