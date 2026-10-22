// pages/r/[slug].js
import React, { useState, useMemo } from 'react';
import Head from 'next/head.js';
import Link from 'next/link.js';
import LinkModel from '../../backend/models/Link.js';
import PromptModal from '../../components/PromptModal.js';

export async function getServerSideProps({ req, res, query }) {
    const { slug } = query;
    const wantsRaw = query.raw === 'true' || 
        req.headers.accept?.includes('text/markdown') || 
        req.headers.accept?.includes('text/plain') ||
        /curl|wget|bot|spider|chatgpt|claude|deepseek|python-requests/i.test(req.headers['user-agent'] || '');

    const link = await LinkModel.findBySlug(slug);

    if (!link) {
        res.statusCode = 404;
        return { props: { error: 'NOT_FOUND', message: 'Repository link not found' } };
    }

    const isExpired = new Date(link.expires_at) < new Date() || link.status === 'expired';
    if (isExpired) {
        res.statusCode = 410;
        return { 
            props: { 
                error: 'EXPIRED', 
                message: 'This repository link has expired. Links remain active for 7 days.' 
            } 
        };
    }

    // Increment view count asynchronously
    LinkModel.incrementViewCount(slug).catch(() => {});

    // If AI or bot or ?raw=true requested raw text:
    if (wantsRaw && link.gist_url && link.status === 'ready') {
        try {
            const storageRes = await fetch(link.gist_url);
            if (storageRes.ok) {
                const text = await storageRes.text();
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.write(text);
                res.end();
                return { props: {} };
            }
        } catch (e) {
            // fall through to HTML render if fetch fails
        }
    }

    // Fetch markdown preview if ready
    let markdownContent = '';
    if (link.gist_url && link.status === 'ready') {
        try {
            const storageRes = await fetch(link.gist_url);
            if (storageRes.ok) {
                markdownContent = await storageRes.text();
            }
        } catch (e) {
            markdownContent = '';
        }
    }

    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    const baseUrl = `${protocol}://${host}`;

    return {
        props: {
            link: {
                id: link.id,
                slug: link.slug,
                repo_url: link.repo_url,
                repo_name: link.repo_name,
                file_count: link.file_count || 0,
                status: link.status,
                created_at: link.created_at ? new Date(link.created_at).toISOString() : null,
                expires_at: link.expires_at ? new Date(link.expires_at).toISOString() : null,
                gist_url: link.gist_url,
                raw_url: `${baseUrl}/api/links/${link.slug}?raw=true`,
                ai_url: `${baseUrl}/r/${link.slug}`,
            },
            markdownPreview: markdownContent.slice(0, 80000), // First 80KB preview
            totalChars: markdownContent.length,
        },
    };
}

export default function RepositoryReader({ link, error, markdownPreview, totalChars }) {
    const [copied, setCopied] = useState(false);
    const [copiedBadge, setCopiedBadge] = useState(false);
    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [fileFilter, setFileFilter] = useState('');

    const filesList = useMemo(() => {
        if (!markdownPreview) return [];
        const files = [];
        const regex = /File:\s*([^\s\n\r]+)/g;
        let match;
        while ((match = regex.exec(markdownPreview)) !== null) {
            files.push(match[1]);
        }
        return files;
    }, [markdownPreview]);

    const filteredFiles = useMemo(() => {
        if (!fileFilter.trim()) return filesList;
        const q = fileFilter.toLowerCase();
        return filesList.filter(f => f.toLowerCase().includes(q));
    }, [filesList, fileFilter]);

    if (error === 'NOT_FOUND') {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full border border-slate-200/90 rounded-3xl p-8 text-center shadow-md">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-slate-900">Repository Link Not Found</h1>
                    <p className="text-slate-500 text-sm mb-6">The link you requested does not exist or has been removed.</p>
                    <Link href="/" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl transition shadow-xs">
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    if (error === 'EXPIRED') {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full border border-slate-200/90 rounded-3xl p-8 text-center shadow-md">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-slate-900">Bridge Link Expired</h1>
                    <p className="text-slate-500 text-sm mb-6">
                        This repository bridge link was created more than 7 days ago and has expired. You can generate a fresh link anytime.
                    </p>
                    <Link href="/dashboard" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl transition shadow-xs">
                        Create Fresh Link
                    </Link>
                </div>
            </div>
        );
    }

    const copyRawUrl = () => {
        navigator.clipboard.writeText(link.raw_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyBadgeCode = () => {
        const badge = `[![AI Readable Codebase](https://img.shields.io/badge/AI_Readable-RepoCodeBridge-6366f1)](${link.ai_url})`;
        navigator.clipboard.writeText(badge);
        setCopiedBadge(true);
        setTimeout(() => setCopiedBadge(false), 2200);
    };

    const daysLeft = link?.expires_at ? Math.max(0, Math.ceil((new Date(link.expires_at) - new Date()) / (1000 * 60 * 60 * 24))) : 7;
    const estimatedTokens = totalChars ? Math.round(totalChars / 4) : 0;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
            <Head>
                <title>{`${link?.repo_name || 'Repository'} - AI-Readable Codebase | RepoCodeBridge`}</title>
                <meta name="description" content={`AI-readable codebase dump for ${link?.repo_name || 'repository'}. Compatible with ChatGPT, Claude, Gemini, DeepSeek.`} />
            </Head>

            {/* Top Navigation Bar */}
            <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 hover:text-indigo-600 transition">
                            <span className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </span>
                            <span className="font-extrabold tracking-tight text-slate-900">
                                RepoCodeBridge
                            </span>
                        </Link>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-600 font-medium text-xs sm:text-sm font-mono truncate max-w-[180px] sm:max-w-xs">{link.repo_name}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Link href="/dashboard" className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition font-medium">
                            Dashboard
                        </Link>
                        <a
                            href={link.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition font-medium shadow-2xs"
                        >
                            <svg className="w-3.5 h-3.5 fill-slate-800" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.21.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.03 1.54 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48C19.13 20.17 22 16.42 22 12c0-5.52-4.48-10-10-10z"/>
                            </svg>
                            <span>GitHub</span>
                            <span className="text-slate-400">↗</span>
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Hero Metadata Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                AI-Ready Codebase
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">{link.repo_name}</h1>
                            <p className="text-slate-500 text-xs sm:text-sm font-mono">{link.repo_url}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono inline-flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {link.file_count} files
                            </span>
                            {estimatedTokens > 0 && (
                                <span className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono inline-flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    ~{estimatedTokens.toLocaleString()} tokens
                                </span>
                            )}
                            <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 inline-flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Active for {daysLeft} more {daysLeft === 1 ? 'day' : 'days'}
                            </span>
                        </div>
                    </div>

                    {/* AI Sharing Action Box */}
                    <div className="mt-6 p-4 sm:p-5 bg-slate-50 border border-indigo-100 rounded-2xl">
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span>Share Directly with Any Web AI</span>
                            </span>
                            <span className="text-xs text-slate-500">Paste in ChatGPT, Claude, Gemini, DeepSeek, Cursor</span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                readOnly
                                value={link.raw_url}
                                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 select-all outline-none"
                            />
                            <button
                                onClick={copyRawUrl}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Copied AI URL!</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                        <span>Copy AI Link</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setPromptModalOpen(true)}
                                className="bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
                            >
                                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span>AI Prompts & Launch</span>
                            </button>
                            <button
                                onClick={copyBadgeCode}
                                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
                                title="Copy Markdown badge for GitHub README"
                            >
                                {copiedBadge ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Copied Badge!</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        <span>README Badge</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Interactive File Quick-Navigator & Explorer */}
                {filesList.length > 0 && (
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                                    Indexed Code Files ({filesList.length})
                                </h3>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <input
                                    type="text"
                                    placeholder="Filter files by name..."
                                    value={fileFilter}
                                    onChange={(e) => setFileFilter(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-600 transition"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                            {filteredFiles.map((file, idx) => (
                                <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 text-[11px] font-mono transition"
                                >
                                    {file}
                                </span>
                            ))}
                            {filteredFiles.length === 0 && (
                                <span className="text-xs text-slate-400 py-1">No matching files found.</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Code Preview Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </span>
                            <h2 className="text-xs sm:text-sm font-bold text-slate-800">Consolidated Codebase Document</h2>
                            <span className="text-[11px] text-slate-500 font-mono">
                                ({totalChars ? `${(totalChars / 1024).toFixed(1)} KB` : ''})
                            </span>
                        </div>
                        <a
                            href={link.raw_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition inline-flex items-center gap-1"
                        >
                            <span>Open Full Raw Output</span>
                            <span>→</span>
                        </a>
                    </div>

                    <div className="p-6 overflow-x-auto max-h-[750px] bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed whitespace-pre selection:bg-indigo-600">
                        {markdownPreview || 'Compiling codebase preview...'}
                    </div>
                </div>
            </main>

            {/* Prompt Modal */}
            <PromptModal
                isOpen={promptModalOpen}
                onClose={() => setPromptModalOpen(false)}
                link={link}
            />
        </div>
    );
}
