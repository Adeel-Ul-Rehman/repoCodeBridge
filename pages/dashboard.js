// pages/dashboard.js
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.js';
import Head from 'next/head.js';
import { useRouter } from 'next/router.js';
import DeleteModal from '../components/DeleteModal.js';
import RefreshModal from '../components/RefreshModal.js';
import PromptModal from '../components/PromptModal.js';

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [links, setLinks] = useState([]);
    const [repoUrl, setRepoUrl] = useState('');
    const [branch, setBranch] = useState('');
    const [subpath, setSubpath] = useState('');
    const [excludeTests, setExcludeTests] = useState(true);
    const [excludeDocs, setExcludeDocs] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [creatingStep, setCreatingStep] = useState('');
    const [creatingProgress, setCreatingProgress] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [refreshing, setRefreshing] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copiedUrl, setCopiedUrl] = useState(null);
    const [filterTab, setFilterTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, slug: null, repoName: '' });
    const [refreshModal, setRefreshModal] = useState({ isOpen: false, slug: null, repoName: '' });
    const [promptModal, setPromptModal] = useState({ isOpen: false, link: null });
    const [bookmarkletModal, setBookmarkletModal] = useState(false);
    
    useEffect(() => {
        fetchUserAndLinks();
        const interval = setInterval(fetchUserAndLinks, 5000);
        return () => clearInterval(interval);
    }, []);

    // Check if a repo URL was passed in query params (e.g. from homepage quick-try or bookmarklet)
    useEffect(() => {
        if (router.isReady && router.query.repo) {
            setRepoUrl(decodeURIComponent(router.query.repo));
        }
    }, [router.isReady, router.query.repo]);
    
    const fetchUserAndLinks = async () => {
        try {
            const userRes = await fetch('/api/auth/me');
            if (!userRes.ok) {
                router.push('/login');
                return;
            }
            const userData = await userRes.json();
            setUser(userData.user);
            
            const linksRes = await fetch('/api/links');
            if (linksRes.ok) {
                const linksData = await linksRes.json();
                setLinks(linksData.links || []);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCreateLink = async (e) => {
        if (e) e.preventDefault();
        const targetUrl = repoUrl.trim();
        if (!targetUrl) {
            setError('Please enter a GitHub repository URL');
            setTimeout(() => setError(''), 5000);
            return;
        }
        
        setCreating(true);
        setError('');
        setSuccess('');
        setCreatingProgress(20);
        setCreatingStep('1/4 Validating repository on GitHub...');
        
        const timer1 = setTimeout(() => {
            setCreatingProgress(45);
            setCreatingStep('2/4 Fetching and streaming repository code archive...');
        }, 1100);

        const timer2 = setTimeout(() => {
            setCreatingProgress(75);
            setCreatingStep('3/4 Parsing file tree and stripping lockfiles & binaries...');
        }, 2200);

        const timer3 = setTimeout(() => {
            setCreatingProgress(90);
            setCreatingStep('4/4 Generating AI markdown & token estimates...');
        }, 3300);
        
        try {
            const res = await fetch('/api/links/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    repoUrl: targetUrl,
                    branch: branch.trim() || undefined,
                    subpath: subpath.trim() || undefined,
                    excludeTests,
                    excludeDocs,
                }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setCreatingProgress(100);
                setSuccess(data.message || 'Repository converted successfully. Your AI link is ready.');
                setRepoUrl('');
                setBranch('');
                setSubpath('');
                setShowAdvanced(false);
                setTimeout(() => fetchUserAndLinks(), 1200);
                setTimeout(() => setSuccess(''), 6000);
            } else {
                setError(data.message || 'Failed to create repository link.');
                setTimeout(() => setError(''), 8000);
            }
        } catch (err) {
            setError('Unable to process repository. Please check your network connection and try again.');
            setTimeout(() => setError(''), 6000);
        } finally {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            setCreating(false);
            setCreatingStep('');
            setCreatingProgress(0);
        }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.includes('github.com')) {
                setRepoUrl(text.trim());
            } else {
                setError('Clipboard does not contain a valid GitHub link.');
                setTimeout(() => setError(''), 3000);
            }
        } catch (e) {
            // Clipboard read permission might be denied
        }
    };
    
    const handleDeleteClick = (slug, repoName) => {
        if (!slug) return;
        setDeleteModal({ isOpen: true, slug, repoName });
    };
    
    const handleConfirmDelete = async () => {
        const { slug } = deleteModal;
        if (!slug) return;
        
        setDeleteModal({ isOpen: false, slug: null, repoName: '' });
        setDeleting(true);
        
        try {
            const res = await fetch(`/api/links/${slug}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (res.ok) {
                setSuccess('Repository bridge deleted successfully.');
                fetchUserAndLinks();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to delete');
                setTimeout(() => setError(''), 4000);
            }
        } catch (err) {
            setError('Something went wrong during deletion.');
            setTimeout(() => setError(''), 4000);
        } finally {
            setDeleting(false);
        }
    };
    
    const handleRefreshClick = (slug, repoName) => {
        if (!slug) return;
        setRefreshModal({ isOpen: true, slug, repoName });
    };
    
    const handleConfirmRefresh = async () => {
        const { slug, repoName } = refreshModal;
        if (!slug) return;
        
        setRefreshModal({ isOpen: false, slug: null, repoName: '' });
        setRefreshing(slug);
        setError('');
        setSuccess('');
        
        try {
            const res = await fetch(`/api/links/${slug}/refresh`, { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                setSuccess(`Fresh pull initiated for ${repoName}. Latest code will be ready shortly.`);
                setTimeout(() => {
                    fetchUserAndLinks();
                    setTimeout(() => setSuccess(''), 3000);
                }, 2000);
            } else {
                setError(data.error || 'Failed to refresh repository');
                setTimeout(() => setError(''), 5000);
            }
        } catch (err) {
            setError('Something went wrong while refreshing');
            setTimeout(() => setError(''), 5000);
        } finally {
            setRefreshing(null);
        }
    };
    
    const handleCopyUrl = (url, slug) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(slug);
        setTimeout(() => setCopiedUrl(null), 2000);
    };
    
    const handleDownloadZip = async (slug, repoName) => {
        setDownloading(slug);
        try {
            const response = await fetch(`/api/links/${slug}/download-zip`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Download failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${repoName.replace('/', '-')}-source-code.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            setSuccess('Download initiated successfully.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Failed to download ZIP');
            setTimeout(() => setError(''), 5000);
        } finally {
            setDownloading(null);
        }
    };
    
    if (loading) {
        return (
            <Layout user={null} onLogout={() => {}}>
                <div className="flex flex-col justify-center items-center h-80 gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 text-xs font-mono">Loading repositories...</p>
                </div>
            </Layout>
        );
    }
    
    const activeLinks = links.filter(l => new Date(l.expires_at) > new Date() && l.status !== 'expired');
    const totalViews = links.reduce((acc, l) => acc + (l.view_count || 0), 0);
    const totalFilesConverted = links.reduce((acc, l) => acc + (l.file_count || 0), 0);

    // Filtering & Search
    const filteredLinks = links.filter(link => {
        const isExpired = new Date(link.expires_at) < new Date() || link.status === 'expired';
        if (filterTab === 'ready' && (link.status !== 'ready' || isExpired)) return false;
        if (filterTab === 'processing' && link.status !== 'processing') return false;
        if (filterTab === 'expired' && !isExpired) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return link.repo_name.toLowerCase().includes(q) || link.repo_url.toLowerCase().includes(q);
        }
        return true;
    });
    
    return (
        <Layout user={user} onLogout={() => setUser(null)}>
            <Head>
                <title>Dashboard - RepoCodeBridge</title>
                <meta name="description" content="Manage your AI-readable repository links and convert GitHub codebases." />
            </Head>

            <div className="max-w-6xl mx-auto space-y-8">
                {/* TOP GREETING & QUICK TOOLS ROW */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                Developer Dashboard
                            </h1>
                            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                                Active Workspace
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Welcome back, <span className="text-slate-800 font-medium font-mono">{user?.email}</span>. Convert and manage your AI codebase bridges.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 1-Click Bookmarklet Tool Button */}
                        <button
                            onClick={() => setBookmarkletModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs cursor-pointer"
                            title="Install 1-click GitHub bookmarklet"
                        >
                            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            <span>1-Click Bookmarklet</span>
                        </button>
                    </div>
                </div>

                {/* 4 USER-CENTRIC STATS CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 font-medium">Active AI Bridges</span>
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono flex items-baseline gap-1.5">
                            <span>{activeLinks.length}</span>
                            <span className="text-xs text-slate-400 font-sans font-normal">/ 50 limit</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-2">
                            Ready for ChatGPT & Claude
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 font-medium">Code Files Bridged</span>
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                            {totalFilesConverted}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-2">
                            Cleaned of lockfiles & binaries
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 font-medium">Total AI Reads</span>
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                            {totalViews}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-2">
                            Single-document LLM pulls
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 font-medium">Retention Policy</span>
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                            7 Days
                        </div>
                        <div className="text-[11px] text-slate-500 mt-2">
                            Automated ephemeral storage
                        </div>
                    </div>
                </div>

                {/* NOTIFICATIONS & ALERTS */}
                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm flex items-start gap-3 animate-fadeIn">
                        <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="flex-1 font-medium">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm flex items-start gap-3 animate-fadeIn">
                        <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="flex-1 font-medium">{success}</span>
                    </div>
                )}

                {/* PRIMARY CONVERT REPOSITORY CARD */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </span>
                            <h2 className="text-base sm:text-lg font-bold text-slate-900">Convert Any GitHub Repository</h2>
                        </div>
                        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                            Valid for 7 days
                        </span>
                    </div>

                    <p className="text-slate-500 text-xs sm:text-sm mb-5">
                        Fetches complete code without rate-limiting, extracts directory hierarchy, and generates an optimized link for LLM context.
                    </p>

                    <form onSubmit={handleCreateLink} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-2xl px-4 py-3 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition shadow-2xs">
                                <span className="text-slate-400 text-sm font-mono mr-2">github.com/</span>
                                <input
                                    type="text"
                                    placeholder="owner/repository (e.g. facebook/react)"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-slate-900 text-sm font-mono placeholder:text-slate-400 focus:ring-0"
                                    disabled={creating}
                                />
                                <button
                                    type="button"
                                    onClick={handlePasteFromClipboard}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 transition inline-flex items-center gap-1 cursor-pointer"
                                    title="Paste URL from clipboard"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <span>Paste</span>
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={creating}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-7 py-3 rounded-2xl transition shadow-xs flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 cursor-pointer"
                            >
                                {creating ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Converting...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                        <span>Convert Repository</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Collapsible Advanced Filtering Options (Branch, Monorepo Subfolder, Ignore Tests) */}
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-xs text-slate-500 hover:text-indigo-600 font-medium inline-flex items-center gap-1.5 transition cursor-pointer py-1"
                            >
                                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-90 text-indigo-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Options: Specific Branch, Monorepo Subfolder & File Filters</span>
                            </button>

                            {showAdvanced && (
                                <div className="mt-2.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-fadeIn">
                                    <div>
                                        <label className="block text-slate-700 font-semibold mb-1">
                                            Branch or Tag <span className="text-slate-400 font-normal">(Optional, defaults to main/master)</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. dev, feature/auth, v2.1.0"
                                            value={branch}
                                            onChange={(e) => setBranch(e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-semibold mb-1">
                                            Monorepo Subfolder <span className="text-slate-400 font-normal">(Optional, isolates relevant code)</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. packages/client or backend"
                                            value={subpath}
                                            onChange={(e) => setSubpath(e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div className="sm:col-span-2 flex flex-wrap items-center gap-5 pt-2 border-t border-slate-200 text-slate-600">
                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={excludeTests}
                                                onChange={(e) => setExcludeTests(e.target.checked)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>Exclude test files (*.test.*, *.spec.*, __tests__)</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={excludeDocs}
                                                onChange={(e) => setExcludeDocs(e.target.checked)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>Exclude extra docs (keeps main README.md)</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>

                    {/* Animated Step-by-Step Progress Feedback */}
                    {creating && (
                        <div className="mt-5 space-y-2 animate-fadeIn">
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div 
                                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${creatingProgress}%` }}
                                ></div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-indigo-700 font-mono">
                                <span>{creatingStep}</span>
                                <span>{creatingProgress}%</span>
                            </div>
                        </div>
                    )}

                    {/* Quick Suggestions */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                        <span>Quick demo:</span>
                        {[
                            { name: 'expressjs/express', url: 'https://github.com/expressjs/express' },
                            { name: 'octocat/Hello-World', url: 'https://github.com/octocat/Hello-World' },
                            { name: 'facebook/react', url: 'https://github.com/facebook/react' },
                        ].map((s) => (
                            <button
                                key={s.name}
                                onClick={() => setRepoUrl(s.url)}
                                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 font-mono transition text-[11px] cursor-pointer"
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* REPOSITORIES LIST SECTION */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        {/* Tabs */}
                        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-medium">
                            <button
                                onClick={() => setFilterTab('all')}
                                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                                    filterTab === 'all' ? 'bg-white text-indigo-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All ({links.length})
                            </button>
                            <button
                                onClick={() => setFilterTab('ready')}
                                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                                    filterTab === 'ready' ? 'bg-white text-indigo-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Ready ({links.filter(l => l.status === 'ready' && new Date(l.expires_at) > new Date()).length})
                            </button>
                            <button
                                onClick={() => setFilterTab('processing')}
                                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                                    filterTab === 'processing' ? 'bg-white text-indigo-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Processing ({links.filter(l => l.status === 'processing').length})
                            </button>
                            <button
                                onClick={() => setFilterTab('expired')}
                                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                                    filterTab === 'expired' ? 'bg-white text-indigo-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Expired ({links.filter(l => new Date(l.expires_at) < new Date() || l.status === 'expired').length})
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search repositories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs"
                            />
                        </div>
                    </div>

                    {/* Repository Cards */}
                    {filteredLinks.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200/90 shadow-2xs">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-slate-800 text-base mb-1">No repositories found</h3>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                {searchQuery ? 'No repositories match your search filter.' : 'Convert your first GitHub repository using the input box above.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredLinks.map((link) => {
                                const isExpired = new Date(link.expires_at) < new Date() || link.status === 'expired';
                                const isReady = link.status === 'ready' && !isExpired;
                                const isProcessing = link.status === 'processing';
                                const isFailed = link.status === 'failed';

                                const daysLeft = link.expires_at ? Math.max(0, Math.ceil((new Date(link.expires_at) - new Date()) / (1000 * 60 * 60 * 24))) : 7;
                                const rawUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/links/${link.slug}?raw=true` : `/api/links/${link.slug}?raw=true`;
                                const readerUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${link.slug}` : `/r/${link.slug}`;
                                
                                const estTokens = link.repo_size_bytes 
                                    ? Math.round(link.repo_size_bytes / 4) 
                                    : (link.file_count || 1) * 350;

                                return (
                                    <div key={link.id} className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition">
                                        {/* Card Header */}
                                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                                                        {link.repo_name}
                                                    </h3>
                                                    <a
                                                        href={link.repo_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-slate-400 hover:text-slate-700 transition"
                                                        title="View on GitHub"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                </div>
                                                <p className="text-xs text-slate-500 font-mono break-all mt-0.5">{link.repo_url}</p>
                                            </div>

                                            {/* Status Badge */}
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                                                isReady ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                isProcessing ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                                                isFailed ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                    isReady ? 'bg-emerald-500' :
                                                    isProcessing ? 'bg-amber-500' :
                                                    isFailed ? 'bg-rose-500' : 'bg-slate-400'
                                                }`}></span>
                                                <span>{isReady ? 'Ready for AI' : isProcessing ? 'Converting...' : isFailed ? 'Failed' : 'Expired'}</span>
                                            </span>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 mb-3 font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>{link.file_count || 0} code files</span>
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                <span>{link.view_count || 0} AI reads</span>
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className={`flex items-center gap-1.5 ${daysLeft <= 2 ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span>{isExpired ? 'Expired' : `${daysLeft} days left`}</span>
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-slate-400 font-mono text-[11px]">
                                                {new Date(link.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {/* Token Window Fit Badge */}
                                        {isReady && link.file_count > 0 && (
                                            <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
                                                <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md font-mono">
                                                    ~{estTokens.toLocaleString()} tokens
                                                </span>
                                                <span className="text-slate-500">
                                                    Fits 100% inside Claude (200k), Gemini (1M), GPT-4o (128k), DeepSeek (64k)
                                                </span>
                                            </div>
                                        )}

                                        {/* Expired Banner */}
                                        {isExpired && (
                                            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl text-xs flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <span>This link has reached the 7-day expiration limit.</span>
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteClick(link.slug, link.repo_name)}
                                                    className="text-rose-600 hover:underline font-semibold cursor-pointer"
                                                >
                                                    Remove Link
                                                </button>
                                            </div>
                                        )}

                                        {/* Ready: Direct AI Link Box */}
                                        {isReady && (
                                            <div className="mb-5 p-4 bg-slate-50 rounded-2xl border border-indigo-100">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                    <span className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                        </svg>
                                                        <span>Direct URL for AI Web Chats</span>
                                                    </span>
                                                    <span className="text-[11px] text-slate-500">Paste in ChatGPT / Claude / Gemini / DeepSeek</span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={rawUrl}
                                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 select-all outline-none"
                                                    />
                                                    <button
                                                        onClick={() => handleCopyUrl(rawUrl, link.slug)}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-2xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                                                    >
                                                        {copiedUrl === link.slug ? (
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
                                                        onClick={() => setPromptModal({ isOpen: true, link })}
                                                        className="bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                        </svg>
                                                        <span>AI Prompts & Launch</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons Row */}
                                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                                            {isReady && (
                                                <>
                                                    <a
                                                        href={readerUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-medium transition inline-flex items-center gap-1.5 shadow-2xs"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                        </svg>
                                                        <span>Open Web Reader</span>
                                                    </a>
                                                    <a
                                                        href={rawUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-medium transition inline-flex items-center gap-1 shadow-2xs"
                                                    >
                                                        <span>Raw Markdown</span>
                                                        <span className="text-slate-400">↗</span>
                                                    </a>
                                                    <button
                                                        onClick={() => handleDownloadZip(link.slug, link.repo_name)}
                                                        disabled={downloading === link.slug}
                                                        className="bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                        <span>{downloading === link.slug ? 'Zipping...' : 'Download ZIP'}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRefreshClick(link.slug, link.repo_name)}
                                                        disabled={refreshing === link.slug}
                                                        className="bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        <span>{refreshing === link.slug ? 'Pulling...' : 'Refresh'}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(link.slug, link.repo_name)}
                                                        className="bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ml-auto cursor-pointer shadow-2xs flex items-center gap-1"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        <span>Delete</span>
                                                    </button>
                                                </>
                                            )}

                                            {isProcessing && (
                                                <div className="flex items-center gap-2.5 text-amber-700 text-xs py-1">
                                                    <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                                                    <span>Converting repository... Refreshing automatically.</span>
                                                </div>
                                            )}

                                            {isFailed && (
                                                <div className="flex items-center justify-between w-full text-xs text-rose-700 py-1">
                                                    <span>Error: {link.last_error || 'Conversion interrupted'}</span>
                                                    <button
                                                        onClick={() => handleDeleteClick(link.slug, link.repo_name)}
                                                        className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-xs cursor-pointer shadow-2xs"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <DeleteModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, slug: null, repoName: '' })}
                onConfirm={handleConfirmDelete}
                repoName={deleteModal.repoName}
            />

            <RefreshModal
                isOpen={refreshModal.isOpen}
                onClose={() => setRefreshModal({ isOpen: false, slug: null, repoName: '' })}
                onConfirm={handleConfirmRefresh}
                repoName={refreshModal.repoName}
            />

            <PromptModal
                isOpen={promptModal.isOpen}
                onClose={() => setPromptModal({ isOpen: false, link: null })}
                link={promptModal.link}
            />

            {/* 1-Click Bookmarklet Modal */}
            {bookmarkletModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                </span>
                                <span>1-Click GitHub Bookmarklet</span>
                            </h3>
                            <button
                                onClick={() => setBookmarkletModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Drag the button below directly onto your browser's Bookmarks bar. Whenever you are visiting any GitHub repository, click the bookmark to automatically create an AI-readable bridge in 1 second.
                            </p>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center">
                                <a
                                    href={`javascript:(function(){var url=window.location.href;if(url.indexOf('github.com')!==-1){window.open('${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard?repo='+encodeURIComponent(url),'_blank');}else{alert('Please navigate to a GitHub repository first!');}})();`}
                                    onClick={(e) => e.preventDefault()}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm cursor-grab active:cursor-grabbing inline-flex items-center gap-2"
                                    title="Drag this button to your browser Bookmarks bar"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>Drag: Bridge to AI</span>
                                </a>
                            </div>
                            <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
                                <li>Make sure your browser's Bookmarks bar is visible (<kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Ctrl+Shift+B</kbd> or <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Cmd+Shift+B</kbd>).</li>
                                <li>Drag the purple <strong>"Bridge to AI"</strong> button up into your bookmarks bar.</li>
                                <li>On any GitHub repository page, click the bookmark to bridge it instantly!</li>
                            </ol>
                        </div>
                        <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/70">
                            <button
                                onClick={() => setBookmarkletModal(false)}
                                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}