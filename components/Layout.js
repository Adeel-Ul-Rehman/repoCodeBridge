// components/Layout.js
import React from 'react';
import Navbar from './Navbar.js';

export default function Layout({ children, user, onLogout }) {
    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar user={user} onLogout={onLogout} />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
            <footer className="bg-gray-800 text-white py-6 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-gray-300">📦 RepoCodeBridge - Making GitHub repositories AI-readable</p>
                    <p className="text-gray-400 text-sm mt-1">Share any GitHub repo link with DeepSeek, ChatGPT, or Claude</p>
                </div>
            </footer>
        </div>
    );
}