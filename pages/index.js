// pages/index.js
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';

export default function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
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
    
    if (loading) {
        return (
            <Layout user={null} onLogout={() => {}}>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            </Layout>
        );
    }
    
    return (
        <Layout user={user} onLogout={() => {}}>
            {/* Hero Section */}
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm mb-12">
                <h1 className="text-5xl font-bold text-gray-800 mb-4">
                    📦 <span className="text-primary-600">RepoCodeBridge</span>
                </h1>
                <p className="text-xl text-gray-600 mb-3">Convert any GitHub repository into an AI-readable format</p>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                    Paste a GitHub URL → Get a shareable link → AI reads your entire codebase instantly
                </p>
                
                {!user ? (
                    <div className="flex gap-4 justify-center flex-wrap">
                        <Link href="/register" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105">
                            🚀 Get Started - Free
                        </Link>
                        <Link href="/login" className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition">
                            Login
                        </Link>
                    </div>
                ) : (
                    <Link href="/dashboard" className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105">
                        📊 Go to Dashboard
                    </Link>
                )}
            </div>
            
            {/* Features Section */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">✨ Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { icon: '📚', title: 'Full Repository', desc: 'Fetches entire codebase including all folders and files' },
                        { icon: '🤖', title: 'AI-Optimized', desc: 'Markdown format with syntax highlighting for LLMs' },
                        { icon: '🔗', title: 'Shareable Links', desc: 'Get permanent URLs that any AI can access' },
                        { icon: '⚡', title: 'Fast Processing', desc: 'Background processing with instant link creation' },
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
                            <div className="text-4xl mb-3">{feature.icon}</div>
                            <h3 className="font-semibold text-gray-800 mb-2">{feature.title}</h3>
                            <p className="text-gray-500 text-sm">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* How It Works */}
            <div className="bg-white rounded-2xl p-8 mb-12">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">📖 How It Works</h2>
                <div className="flex flex-wrap justify-center items-center gap-8">
                    {[
                        { num: '1', title: 'Paste GitHub URL', desc: 'Enter any public repository URL' },
                        { num: '2', title: 'AI Processes Code', desc: 'We fetch and format for optimal AI reading' },
                        { num: '3', title: 'Get AI Link', desc: 'Share the link with DeepSeek, ChatGPT, or Claude' },
                    ].map((step, idx) => (
                        <div key={idx} className="text-center flex-1 min-w-[200px]">
                            <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                                {step.num}
                            </div>
                            <h3 className="font-semibold text-gray-800 mb-1">{step.title}</h3>
                            <p className="text-gray-500 text-sm">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Pricing */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">💰 Simple Pricing</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
                        <h3 className="text-xl font-bold text-center text-gray-800">Free</h3>
                        <div className="text-3xl font-bold text-center text-primary-600 my-4">$0</div>
                        <ul className="space-y-2 text-gray-600">
                            <li className="flex items-center gap-2">✅ 5 active links</li>
                            <li className="flex items-center gap-2">✅ 100MB per repo</li>
                            <li className="flex items-center gap-2">✅ 7 days expiry</li>
                            <li className="flex items-center gap-2">✅ AI-readable output</li>
                        </ul>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 shadow-sm border-2 border-yellow-300">
                        <h3 className="text-xl font-bold text-center text-gray-800">Premium</h3>
                        <div className="text-3xl font-bold text-center text-yellow-600 my-4">$0</div>
                        <ul className="space-y-2 text-gray-600">
                            <li className="flex items-center gap-2">⭐ Unlimited links</li>
                            <li className="flex items-center gap-2">⭐ 200MB per repo</li>
                            <li className="flex items-center gap-2">⭐ 30 days expiry</li>
                            <li className="flex items-center gap-2">⭐ Priority processing</li>
                        </ul>
                        <p className="text-center text-xs text-yellow-600 mt-4">For developer account</p>
                    </div>
                </div>
            </div>
            
            {/* CTA Footer */}
            <div className="text-center bg-gray-800 rounded-2xl p-8">
                <p className="text-white text-lg mb-4">Ready to make your code AI-ready?</p>
                {!user ? (
                    <Link href="/register" className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition">
                        Start Now - It's Free →
                    </Link>
                ) : (
                    <Link href="/dashboard" className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition">
                        Go to Dashboard →
                    </Link>
                )}
            </div>
        </Layout>
    );
}