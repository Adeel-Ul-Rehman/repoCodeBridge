// components/RepoForm.js
import React, { useState } from 'react';

export default function RepoForm({ onSubmit, isLoading, maxSizeMB = 150 }) {
    const [repoUrl, setRepoUrl] = useState('');
    const [error, setError] = useState('');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        
        if (!repoUrl.trim()) {
            setError('Please enter a GitHub repository URL');
            return;
        }
        
        if (!repoUrl.includes('github.com')) {
            setError('Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)');
            return;
        }
        
        onSubmit(repoUrl.trim());
        setRepoUrl('');
    };
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm mb-6">
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                </span>
                <span>Create New Repository Link</span>
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <input
                    type="text"
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs font-mono"
                    disabled={isLoading}
                />
                <button 
                    type="submit" 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            <span>Creating...</span>
                        </>
                    ) : (
                        <span>Create Link</span>
                    )}
                </button>
            </form>
            {error && (
                <p className="text-rose-600 text-xs mt-2.5 font-medium flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                </p>
            )}
            <p className="text-slate-500 text-xs mt-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Public repositories supported up to {maxSizeMB}MB. All links remain active for 7 days.</span>
            </p>
        </div>
    );
}