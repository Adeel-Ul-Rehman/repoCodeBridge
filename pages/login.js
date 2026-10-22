// pages/login.js
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';
import Head from 'next/head.js';
import { useRouter } from 'next/router.js';

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [oauthHint, setOauthHint] = useState(false);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (!router.isReady) return;
        const queryError = router.query.error;
        const queryMsg = router.query.msg;

        if (queryError) {
            if (queryError.includes('github')) {
                setError(queryMsg ? `GitHub authentication: ${decodeURIComponent(queryMsg)}` : 'GitHub sign-in was cancelled or encountered a redirect error.');
                setOauthHint(true);
            } else if (queryError.includes('google')) {
                setError(queryMsg ? `Google authentication: ${decodeURIComponent(queryMsg)}` : 'Google sign-in was cancelled or failed.');
            } else {
                setError('Authentication failed. Please verify your credentials.');
            }
        }
    }, [router.isReady, router.query]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setOauthHint(false);
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                router.push('/dashboard');
            } else {
                setError(data.error || 'Invalid email or password.');
            }
        } catch (err) {
            setError('Unable to connect to the authentication service. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Layout user={null} onLogout={() => {}}>
            <Head>
                <title>Sign In - RepoCodeBridge</title>
                <meta name="description" content="Sign in to your RepoCodeBridge account to manage your AI codebase links." />
            </Head>
            <div className="min-h-[calc(100vh-220px)] flex items-center justify-center py-10 px-4">
                <div className="bg-white rounded-3xl p-8 sm:p-10 w-full max-w-md border border-slate-200/90 shadow-md relative overflow-hidden animate-fadeIn">
                    <div className="text-center mb-7">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">Sign in to manage your AI codebase bridges</p>
                    </div>
                    
                    {error && (
                        <div className="mb-5 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex flex-col gap-2 animate-fadeIn">
                            <div className="flex items-start gap-2.5">
                                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="flex-1 font-medium">{error}</span>
                            </div>
                            {oauthHint && (
                                <div className="mt-1 pt-2 border-t border-rose-200 text-[11px] text-slate-700 space-y-1">
                                    <p className="font-semibold text-rose-900">GitHub Developer Callback Notice:</p>
                                    <p>Ensure your OAuth App Authorization Callback URL in GitHub Developer Settings matches:</p>
                                    <code className="block bg-white p-2 rounded-lg border border-rose-200 font-mono text-slate-800 text-[11px] break-all select-all">
                                        {typeof window !== 'undefined' ? `${window.location.origin}/api/auth/github/callback` : 'http://localhost:3000/api/auth/github/callback'}
                                    </code>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Social OAuth Buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <a
                            href="/api/auth/google"
                            className="flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs"
                        >
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Google</span>
                        </a>
                        <a
                            href="/api/auth/github"
                            className="flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs"
                        >
                            <svg className="h-4 w-4 shrink-0 fill-slate-900" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.21.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.03 1.54 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48C19.13 20.17 22 16.42 22 12c0-5.52-4.48-10-10-10z"/>
                            </svg>
                            <span>GitHub</span>
                        </a>
                    </div>
                    
                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-mono">
                            <span className="px-3 bg-white text-slate-400 font-semibold">Or continue with email</span>
                        </div>
                    </div>
                    
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
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-slate-700 text-xs font-semibold uppercase tracking-wider">Password</label>
                                <Link href="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                                    Forgot?
                                </Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-sm text-slate-900 transition placeholder:text-slate-400"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <span>Sign In to Dashboard</span>
                            )}
                        </button>
                    </form>
                    
                    <div className="mt-6 text-center text-xs text-slate-600">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold underline">
                            Create free account
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
}