// pages/login.js
import React, { useState } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';
import { useRouter } from 'next/router.js';

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                router.push('/dashboard');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Layout user={null} onLogout={() => {}}>
            <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Welcome Back</h1>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        
                        <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                    
                    <div className="text-center mt-4">
                        <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
                            Forgot Password?
                        </Link>
                    </div>
                    
                    <p className="text-center text-gray-600 text-sm mt-6">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                            Register
                        </Link>
                    </p>
                </div>
            </div>
        </Layout>
    );
}