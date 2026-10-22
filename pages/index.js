// pages/index.js
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';
import Head from 'next/head.js';
import { useRouter } from 'next/router.js';

export default function Home() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quickRepo, setQuickRepo] = useState('');
    const [activeTab, setActiveTab] = useState('prompt');
    
    useEffect(() => {
        checkAuth();
    }, []);
    
    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            }
        } catch (err) {
            console.error('Auth check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSubmit = (e) => {
        e.preventDefault();
        if (!quickRepo.trim()) return;
        if (user) {
            router.push(`/dashboard?repo=${encodeURIComponent(quickRepo.trim())}`);
        } else {
            router.push(`/register?repo=${encodeURIComponent(quickRepo.trim())}`);
        }
    };
    
    if (loading) {
        return (
            <Layout user={null} onLogout={() => {}}>
                <div className="flex justify-center items-center h-80">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }
    
    return (
        <Layout user={user} onLogout={() => setUser(null)}>
            <Head>
                <title>RepoCodeBridge - Convert GitHub Repositories for Direct AI Reasoning</title>
                <meta name="description" content="Generate structured, single-document links of complete GitHub repositories. Work directly with ChatGPT, Claude, Gemini, DeepSeek, and Cursor." />
            </Head>

            {/* HERO SECTION */}
            <section className="text-center pt-8 pb-16 sm:pt-14 sm:pb-20 relative">
                {/* Clean Announcement Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-6 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    <span>High-Speed Zipball Engine • 100% Free Developer Tool</span>
                </div>

                {/* Hero Title */}
                <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-5 max-w-4xl mx-auto leading-[1.15]">
                    Convert Any GitHub Repository into an <span className="text-gradient">AI-Readable</span> Link
                </h1>

                {/* Hero Subtitle */}
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
                    Generate an optimized, token-aware single document containing your entire repository. Share it directly with <span className="font-semibold text-slate-900">ChatGPT</span>, <span className="font-semibold text-slate-900">Claude</span>, <span className="font-semibold text-slate-900">Gemini</span>, or <span className="font-semibold text-slate-900">DeepSeek</span> for full-context comprehension.
                </p>

                {/* Quick Convert Box */}
                <div className="max-w-2xl mx-auto mb-8">
                    <form onSubmit={handleQuickSubmit} className="bg-white p-2 rounded-2xl shadow-md border border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 flex flex-col sm:flex-row gap-2 transition">
                        <div className="flex-1 flex items-center px-3.5 gap-2.5">
                            {/* GitHub SVG Icon */}
                            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.21.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.03 1.54 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48C19.13 20.17 22 16.42 22 12c0-5.52-4.48-10-10-10z"/>
                            </svg>
                            <span className="text-slate-400 font-mono text-sm hidden sm:inline">github.com/</span>
                            <input
                                type="text"
                                placeholder="owner/repository (e.g. expressjs/express)"
                                value={quickRepo}
                                onChange={(e) => setQuickRepo(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-slate-900 text-sm font-mono placeholder:text-slate-400 placeholder:font-sans focus:ring-0"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                            <span>Convert for AI</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </form>

                    {/* Quick Try Sample Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 text-xs text-slate-500">
                        <span>Try popular:</span>
                        {[
                            { name: 'expressjs/express', url: 'https://github.com/expressjs/express' },
                            { name: 'octocat/Hello-World', url: 'https://github.com/octocat/Hello-World' },
                            { name: 'facebook/react', url: 'https://github.com/facebook/react' },
                        ].map((sample) => (
                            <button
                                key={sample.name}
                                onClick={() => setQuickRepo(sample.url)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 font-mono transition text-[11px] shadow-xs cursor-pointer"
                            >
                                {sample.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Key Benefits Row */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        Zero GitHub API Rate Limit Wait
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        7-Day Ephemeral Storage Purge
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        100% Free General Tool
                    </span>
                </div>
            </section>

            {/* LIVE PREVIEW MOCKUP */}
            <section className="max-w-5xl mx-auto mb-20">
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg overflow-hidden">
                    {/* Window Title Bar */}
                    <div className="bg-slate-100/90 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                                <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                                <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                            </div>
                            <span className="text-xs font-mono text-slate-600 ml-2 font-medium">
                                repocodebridge.vercel.app/r/express-preview
                            </span>
                        </div>

                        {/* Interactive Tab Switcher */}
                        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
                            <button
                                onClick={() => setActiveTab('prompt')}
                                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                                    activeTab === 'prompt' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                AI Code Format
                            </button>
                            <button
                                onClick={() => setActiveTab('tree')}
                                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                                    activeTab === 'tree' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Directory Tree
                            </button>
                            <button
                                onClick={() => setActiveTab('models')}
                                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                                    activeTab === 'models' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Compatible Models
                            </button>
                        </div>
                    </div>

                    {/* Window Body */}
                    <div className="p-6 sm:p-8 font-mono text-xs text-slate-800 leading-relaxed overflow-x-auto min-h-[280px] bg-white">
                        {activeTab === 'prompt' && (
                            <div className="space-y-4">
                                <div className="text-indigo-700 font-bold"># Repository: expressjs/express</div>
                                <div className="text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    &gt; **RepoCodeBridge AI Codebase Dump**<br />
                                    &gt; Total Files: 42 | Estimated Tokens: ~18,400 | Default Branch: master<br />
                                    &gt; Formatted for direct reasoning by ChatGPT, Claude, Gemini, DeepSeek.
                                </div>
                                <div className="border-t border-slate-200 pt-3 text-slate-500">
                                    <span className="text-slate-400">================================================================</span><br />
                                    <span className="text-slate-900 font-bold">File: package.json (Language: json)</span><br />
                                    <span className="text-slate-400">================================================================</span>
                                </div>
                                <div className="text-indigo-900 whitespace-pre bg-slate-50 p-3 rounded-xl border border-slate-200">
{`{
  "name": "express",
  "description": "Fast, unopinionated, minimalist web framework",
  "version": "4.19.2",
  "main": "lib/express.js"
}`}
                                </div>
                            </div>
                        )}

                        {activeTab === 'tree' && (
                            <div className="space-y-2 text-slate-700">
                                <div className="text-indigo-700 font-bold mb-2">Directory Hierarchy Generation</div>
                                <pre className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700 leading-normal">
{`express/
├── lib/
│   ├── express.js
│   ├── request.js
│   ├── response.js
│   ├── utils.js
│   ├── middleware/
│   │   ├── init.js
│   │   └── query.js
│   └── router/
│       ├── index.js
│       ├── layer.js
│       └── route.js
├── package.json
└── README.md`}
                                </pre>
                            </div>
                        )}

                        {activeTab === 'models' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-sans text-sm">
                                {[
                                    { name: 'ChatGPT Web (GPT-4o)', desc: 'Reads the bridge link directly via web search and parses entire codebase structure.' },
                                    { name: 'Claude 3.5 Sonnet', desc: 'Accepts the link or 1-click prompt into its massive 200k token window for deep architecture review.' },
                                    { name: 'DeepSeek V3 / R1', desc: 'Superior reasoning and debugging on consolidated multi-file repositories.' },
                                    { name: 'Google Gemini 1.5 Pro', desc: 'Handles multi-file codebases effortlessly with up to 1 million token context.' },
                                    { name: 'Cursor & Windsurf', desc: 'Ingests the link as external context for multi-file workspace indexing.' },
                                    { name: 'Copilot Workspace', desc: 'Provides comprehensive repository overview for bug fixing and feature planning.' },
                                ].map((model) => (
                                    <div key={model.name} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="font-bold text-slate-900 mb-1">{model.name}</div>
                                        <p className="text-xs text-slate-600 leading-relaxed">{model.desc}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* KEY FEATURES GRID */}
            <section className="mb-20">
                <div className="text-center mb-12">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 mb-3 inline-block">
                        Engineered for High Performance
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Built for Developers Working with AI
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-xl mx-auto">
                        Skip tedious manual copying. One clean link provides your entire codebase with token metrics and clean hierarchy.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { 
                            title: '1-Second Extraction', 
                            desc: 'Direct in-memory archive streaming unpacks thousands of code files without exhausting GitHub API limits.',
                            icon: (
                                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            )
                        },
                        { 
                            title: 'Token-Aware Markdown', 
                            desc: 'Calculates estimated LLM token usage and prioritizes manifest files like package.json and README first.',
                            icon: (
                                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            )
                        },
                        { 
                            title: '7-Day Safe Expiry', 
                            desc: 'All generated links automatically purge after 7 days, maintaining clean storage and temporary code references.',
                            icon: (
                                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )
                        },
                        { 
                            title: 'Complete Source ZIP', 
                            desc: 'Export clean unbundled source files or consolidated single-file markdown archives anytime with one click.',
                            icon: (
                                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )
                        },
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                                {feature.icon}
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2 text-base">{feature.title}</h3>
                            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="bg-white rounded-3xl p-8 sm:p-12 mb-20 border border-slate-200/90 shadow-sm">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        How It Works
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">From GitHub repository to AI reasoning in 3 steps</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            step: '01',
                            title: 'Enter Repository URL',
                            desc: 'Provide any public GitHub repository link. Our engine resolves the branch and streams the codebase archive.',
                        },
                        {
                            step: '02',
                            title: 'Intelligent Filtering',
                            desc: 'We filter out lockfiles, node_modules, build artifacts, and binary files, retaining only relevant source code.',
                        },
                        {
                            step: '03',
                            title: 'Share with Web AI',
                            desc: 'Paste the generated URL into ChatGPT, Claude, or DeepSeek and begin pair-programming with full project awareness.',
                        },
                    ].map((item, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                            <span className="text-2xl font-black font-mono text-indigo-600 block mb-2">{item.step}</span>
                            <h3 className="font-bold text-slate-900 text-base mb-1.5">{item.title}</h3>
                            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* BOTTOM CALL TO ACTION */}
            <section className="text-center py-14 px-6 rounded-3xl bg-indigo-600 text-white shadow-lg mb-8">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">
                        Ready to convert your first repository?
                    </h2>
                    <p className="text-indigo-100 text-sm sm:text-base mb-8 font-normal">
                        Join developers using RepoCodeBridge for faster debugging, architectural exploration, and AI pair-programming.
                    </p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        {!user ? (
                            <Link 
                                href="/register" 
                                className="bg-white text-indigo-700 hover:bg-slate-50 font-bold text-sm px-6 py-3 rounded-xl transition shadow-sm"
                            >
                                Start Free Now
                            </Link>
                        ) : (
                            <Link 
                                href="/dashboard" 
                                className="bg-white text-indigo-700 hover:bg-slate-50 font-bold text-sm px-6 py-3 rounded-xl transition shadow-sm"
                            >
                                Open Dashboard
                            </Link>
                        )}
                    </div>
                </div>
            </section>
        </Layout>
    );
}