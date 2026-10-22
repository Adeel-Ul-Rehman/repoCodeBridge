// components/LinkCard.js
import React, { useState } from 'react';

export default function LinkCard({ link, onDelete }) {
    const [copied, setCopied] = useState(false);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    };
    
    const isExpired = new Date(link.expires_at) < new Date() || link.status === 'expired';
    const isReady = link.status === 'ready' && !isExpired;
    const rawUrl = `/api/links/${link.slug}?raw=true`;
    const readUrl = `/r/${link.slug}`;

    const handleCopy = () => {
        const fullUrl = `${window.location.origin}${rawUrl}`;
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition">
            <div className="flex justify-between items-start gap-3 mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-slate-900 font-bold text-base">{link.repo_name}</h3>
                    <a 
                        href={link.repo_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-slate-400 hover:text-slate-600 transition"
                        title="View on GitHub"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                    isReady ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    link.status === 'processing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    isExpired ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                        isReady ? 'bg-emerald-500' :
                        link.status === 'processing' ? 'bg-amber-500 animate-pulse' :
                        isExpired ? 'bg-slate-400' : 'bg-red-500'
                    }`}></span>
                    <span>{isReady ? 'Ready for AI' : link.status === 'processing' ? 'Processing' : isExpired ? 'Expired' : 'Failed'}</span>
                </span>
            </div>
            
            <p className="text-slate-500 text-xs font-mono break-all mb-3">{link.repo_url}</p>
            
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-4">
                <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {link.file_count || 0} files
                </span>
                <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {link.view_count || 0} views
                </span>
                <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Expires: {formatDate(link.expires_at)}
                </span>
            </div>
            
            {isExpired && (
                <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>This link has reached the 7-day expiration limit.</span>
                </div>
            )}
            
            {isReady && (
                <div className="flex flex-wrap items-center gap-2">
                    <a 
                        href={readUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-medium transition inline-flex items-center gap-1.5 shadow-2xs"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>Open Reader</span>
                    </a>
                    <button
                        onClick={handleCopy}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        {copied ? (
                            <>
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Copied AI URL</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Copy AI URL</span>
                            </>
                        )}
                    </button>
                    <button 
                        onClick={() => onDelete(link.slug)}
                        className="bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-xl text-xs font-medium transition ml-auto inline-flex items-center gap-1 cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                    </button>
                </div>
            )}
            
            {link.status === 'processing' && (
                <div className="bg-amber-50 text-amber-800 border border-amber-200 p-2.5 rounded-xl text-xs flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Processing repository code into AI-readable format...</span>
                </div>
            )}
            
            {link.status === 'failed' && (
                <div className="bg-rose-50 text-rose-700 border border-rose-200 p-2.5 rounded-xl text-xs flex items-center justify-between">
                    <span className="font-medium">Failed: {link.last_error}</span>
                    <button onClick={() => onDelete(link.slug)} className="text-rose-700 underline text-xs font-semibold cursor-pointer">Delete</button>
                </div>
            )}
        </div>
    );
}