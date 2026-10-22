// pages/forgot-password.js
import React, { useState } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';
import Head from 'next/head.js';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setSuccess(data.message || 'Verification code sent to your email.');
                setEmail('');
            } else {
                setError(data.error || 'Unable to send reset code.');
            }
        } catch (err) {
            setError('Something went wrong. Please check your network.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Layout user={null} onLogout={() => {}}>
            <Head>
                <title>Forgot Password - RepoCodeBridge</title>
                <meta name="description" content="Reset your RepoCodeBridge account password." />
            </Head>
            <div className="min-h-[calc(100vh-220px)] flex items-center justify-center py-10 px-4">
                <div className="bg-white rounded-3xl p-8 sm:p-10 w-full max-w-md border border-slate-200/90 shadow-md relative overflow-hidden animate-fadeIn">
                    <div className="text-center mb-7">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Forgot Password</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">
                            Enter your email address and we will send you an OTP to reset your password.
                        </p>
                    </div>
                    
                    {error && (
                        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2.5 animate-fadeIn">
                            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="flex-1 font-medium">{error}</span>
                        </div>
                    )}
                    
                    {success && (
                        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex flex-col gap-2 animate-fadeIn">
                            <div className="flex items-start gap-2.5">
                                <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="flex-1 font-medium">{success}</span>
                            </div>
                            <div className="mt-1 pt-2 border-t border-emerald-200">
                                <Link href="/reset-password" className="text-indigo-600 hover:text-indigo-700 font-semibold underline">
                                    Go to Reset Password Form →
                                </Link>
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-sm text-slate-900 transition placeholder:text-slate-400"
                                placeholder="developer@example.com"
                                required
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60" 
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Sending OTP...</span>
                                </span>
                            ) : (
                                <span>Send Reset OTP</span>
                            )}
                        </button>
                    </form>
                    
                    <p className="text-center text-slate-600 text-xs mt-6">
                        Remember your password?{' '}
                        <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold underline">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </Layout>
    );
}