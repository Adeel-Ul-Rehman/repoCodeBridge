// components/PromptModal.js
import React, { useState } from 'react';

export default function PromptModal({ isOpen, onClose, link }) {
    const [copiedIndex, setCopiedIndex] = useState(null);

    if (!isOpen || !link) return null;

    const rawUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/links/${link.slug}?raw=true` 
        : `/api/links/${link.slug}?raw=true`;

    const prompts = [
        {
            title: 'Pair Programming & Architecture',
            description: 'Comprehensive overview to help you navigate, understand, and build features.',
            text: `Here is the complete codebase for "${link.repo_name}":\n\n${rawUrl}\n\nPlease read through this codebase, analyze its structure and components, and help me with architecture planning and pair programming.`,
        },
        {
            title: 'Security & Vulnerability Audit',
            description: 'Inspect for OWASP vulnerabilities, injection flaws, and unsafe data handling.',
            text: `Here is the complete codebase for "${link.repo_name}":\n\n${rawUrl}\n\nPlease perform a thorough security audit on this repository. Identify any potential security vulnerabilities, insecure dependencies, unsanitized inputs, or authentication weaknesses, and provide recommended fixes.`,
        },
        {
            title: 'Bug Hunter & Edge Cases',
            description: 'Locate potential race conditions, boundary bugs, and unhandled errors.',
            text: `Here is the complete codebase for "${link.repo_name}":\n\n${rawUrl}\n\nPlease review this code for potential edge-case bugs, unhandled exceptions, race conditions, memory leaks, and performance bottlenecks. List each issue with the affected file and line context.`,
        },
        {
            title: 'Unit Test Generator',
            description: 'Generate comprehensive test suites with high branch coverage.',
            text: `Here is the complete codebase for "${link.repo_name}":\n\n${rawUrl}\n\nPlease generate a comprehensive unit and integration test suite for the core modules in this codebase. Include tests for edge cases, error conditions, and happy paths.`,
        },
        {
            title: 'Refactoring & Clean Code',
            description: 'Identify code smells and suggest idiomatic refactoring.',
            text: `Here is the complete codebase for "${link.repo_name}":\n\n${rawUrl}\n\nPlease analyze this codebase for code duplication, high complexity, and suboptimal patterns. Suggest concrete refactoring improvements to make the code cleaner, more modular, and maintainable.`,
        },
    ];

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2200);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </span>
                            <span>AI Task Prompts & Web Launch</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Repository: <span className="font-mono text-slate-700 font-semibold">{link.repo_name}</span>
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Direct Launch Web AI Bar */}
                <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-600 font-medium">
                        Launch directly in your web AI:
                    </span>
                    <div className="flex items-center gap-2">
                        <a
                            href="https://chatgpt.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs"
                        >
                            <span>ChatGPT</span>
                            <span className="text-slate-400">↗</span>
                        </a>
                        <a
                            href="https://claude.ai/new"
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs"
                        >
                            <span>Claude</span>
                            <span className="text-slate-400">↗</span>
                        </a>
                        <a
                            href="https://gemini.google.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs"
                        >
                            <span>Gemini</span>
                            <span className="text-slate-400">↗</span>
                        </a>
                    </div>
                </div>

                {/* Presets List */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <p className="text-xs text-slate-500">
                        Choose a specialized prompt below. The bridge URL is already embedded. Click copy, then paste directly into your AI chat window.
                    </p>

                    <div className="space-y-3">
                        {prompts.map((p, idx) => (
                            <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">{p.title}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleCopy(p.text, idx)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                                    >
                                        {copiedIndex === idx ? (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                </svg>
                                                <span>Copy Prompt</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-600 line-clamp-2">
                                    {p.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/70">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
