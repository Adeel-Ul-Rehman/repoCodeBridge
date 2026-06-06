// pages/forgot-password.js
import React, { useState } from 'react';
import Layout from '../components/Layout.js';
import Link from 'next/link.js';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setSuccess(data.message || 'OTP sent to your email!');
                setEmail('');
            } else {
                setError(data.error || 'Something went wrong');
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
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">🔐 Forgot Password?</h1>
                    <p className="text-center text-gray-500 text-sm mb-6">
                        Enter your email address and we'll send you an OTP to reset your password.
                    </p>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                            {success}
                            <div className="mt-2">
                                <Link href="/reset-password" className="text-primary-600 hover:text-primary-700 font-medium">
                                    Go to Reset Password →
                                </Link>
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        
                        <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50" disabled={loading}>
                            {loading ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                    </form>
                    
                    <p className="text-center text-gray-600 text-sm mt-6">
                        Remember your password? <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Login</Link>
                    </p>
                </div>
            </div>
        </Layout>
    );
}