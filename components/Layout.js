// components/Layout.js
import React from 'react';
import Navbar from './Navbar.js';
import Link from 'next/link.js';

export default function Layout({ children, user, onLogout }) {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 relative">
            <Navbar user={user} onLogout={onLogout} />
            
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                {children}
            </main>
            
            {/* Elegant Professional Footer */}
            <footer className="border-t border-slate-200/90 bg-white text-slate-500 py-10 mt-16 text-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 18 22 12 16 6"></polyline>
                                <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                                <span>RepoCodeBridge</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-semibold uppercase">
                                    Version 2.0
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Single-document codebase bridge for LLM reasoning and analysis
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Token-Optimized
                        </span>
                        <span>7-Day Ephemeral Storage</span>
                        <span>100% Free Developer Tool</span>
                    </div>

                    <div className="text-xs text-slate-400">
                        © {new Date().getFullYear()} RepoCodeBridge. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}