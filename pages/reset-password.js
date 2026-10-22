// pages/reset-password.js
import React, { useState } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';
import Head from 'next/head.js';
import { useRouter } from 'next/router.js';

export default function ResetPassword() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }
        
        setLoading(true);
        setError('');
        setSuccess('');
        
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setSuccess('Password reset successfully. Redirecting to login...');
                setTimeout(() => {
                    router.push('/login');
                }, 1800);
            } else {
                setError(data.error || 'Failed to reset password. Please check your OTP.');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Layout user={null} onLogout={() => {}}>
            <Head>
                <title>Reset Password - RepoCodeBridge</title>
                <meta name="description" content="Set a new password for your RepoCodeBridge account." />
            </Head>
            <div className="min-h-[calc(100vh-220px)] flex items-center justify-center py-10 px-4">
                <div className="bg-white rounded-3xl p-8 sm:p-10 w-full max-w-md border border-slate-200/90 shadow-md relative overflow-hidden animate-fadeIn">
                    <div className="text-center mb-7">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reset Password</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">
                            Enter the OTP verification code and choose a new password
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
                        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 animate-fadeIn">
                            <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="flex-1 font-medium">{success}</span>
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
                        
                        <div>
                            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1.5">OTP Code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="6-digit verification code"
                                maxLength="6"
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-sm text-slate-900 font-mono tracking-widest text-center transition placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1.5">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-sm text-slate-900 transition placeholder:text-slate-400"
                                placeholder="At least 6 characters"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-sm text-slate-900 transition placeholder:text-slate-400"
                                placeholder="Re-enter password"
                                required
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2" 
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Resetting password...</span>
                                </span>
                            ) : (
                                <span>Reset Password</span>
                            )}
                        </button>
                    </form>
                    
                    <p className="text-center text-slate-600 text-xs mt-6">
                        <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold underline">
                            Back to Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </Layout>
    );
}