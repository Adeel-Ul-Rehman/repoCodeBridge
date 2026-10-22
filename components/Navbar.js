// components/Navbar.js
import React, { useState } from 'react';
import Link from 'next/link.js';
import { useRouter } from 'next/router.js';

export default function Navbar({ user, onLogout }) {
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        if (onLogout) onLogout();
        router.push('/');
    };
    
    return (
        <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-50 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Brand Logo */}
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20 group-hover:bg-indigo-700 transition">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="16 18 22 12 16 6"></polyline>
                                    <polyline points="8 6 2 12 8 18"></polyline>
                                </svg>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-lg tracking-tight group-hover:text-indigo-600 transition">
                                    RepoCodeBridge
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold uppercase">
                                    v2.0
                                </span>
                            </div>
                        </Link>
                    </div>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-3">
                        {user ? (
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-slate-700 text-xs font-mono">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="max-w-[180px] truncate">{user.email}</span>
                                </div>

                                <Link 
                                    href="/dashboard" 
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-1.5 ${
                                        router.pathname === '/dashboard' 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    Dashboard
                                </Link>

                                <button
                                    onClick={handleLogout}
                                    className="text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-3 py-2 rounded-xl transition cursor-pointer"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-3">
                                <Link 
                                    href="/login" 
                                    className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition border border-transparent hover:border-slate-200"
                                >
                                    Sign In
                                </Link>
                                <Link 
                                    href="/register" 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm shadow-indigo-600/20"
                                >
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>
                    
                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-slate-600 hover:text-slate-900 p-2 rounded-xl bg-slate-100 border border-slate-200 focus:outline-none cursor-pointer"
                            aria-label="Toggle menu"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isMobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Mobile Dropdown */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-5 space-y-2">
                    {user ? (
                        <>
                            <div className="text-slate-500 text-xs font-mono py-1 px-2 border-b border-slate-100 mb-2 truncate">
                                {user.email}
                            </div>
                            <Link 
                                href="/dashboard" 
                                className="block px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 text-center"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Open Dashboard
                            </Link>
                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    handleLogout();
                                }}
                                className="w-full text-center px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                            >
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <Link 
                                href="/login" 
                                className="block px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 text-center"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Sign In
                            </Link>
                            <Link 
                                href="/register" 
                                className="block px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 text-center"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Get Started
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
}