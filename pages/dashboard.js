// pages/dashboard.js
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.js';
import { useRouter } from 'next/router.js';
import DeleteModal from '../components/DeleteModal.js';
import RefreshModal from '../components/RefreshModal.js';

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [links, setLinks] = useState([]);
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [refreshing, setRefreshing] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copiedUrl, setCopiedUrl] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, slug: null, repoName: '' });
    const [refreshModal, setRefreshModal] = useState({ isOpen: false, slug: null, repoName: '' });
    
    useEffect(() => {
        fetchUserAndLinks();
        const interval = setInterval(fetchUserAndLinks, 10000);
        return () => clearInterval(interval);
    }, []);
    
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
                const validLinks = (linksData.links || []).filter(link => {
                    if (link.status === 'ready' && !link.gist_url) return false;
                    return true;
                });
                setLinks(validLinks);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCreateLink = async (e) => {
        e.preventDefault();
        if (!repoUrl.trim()) {
            setError('⚠️ Please enter a repository URL');
            setTimeout(() => setError(''), 5000);
            return;
        }
        
        setCreating(true);
        setError('');
        setSuccess('');
        
        try {
            const res = await fetch('/api/links/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl: repoUrl.trim() }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setSuccess(data.message || '✅ Link created! Processing in background...');
                setRepoUrl('');
                setTimeout(() => fetchUserAndLinks(), 2000);
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.message || 'Failed to create link');
                setTimeout(() => setError(''), 8000);
            }
        } catch (err) {
            setError('❌ Something went wrong. Please try again.');
            setTimeout(() => setError(''), 5000);
        } finally {
            setCreating(false);
        }
    };
    
    const handleDeleteClick = (slug, repoName) => {
        if (!slug) {
            setError('Invalid link');
            return;
        }
        setDeleteModal({ isOpen: true, slug, repoName });
    };
    
    const handleConfirmDelete = async () => {
        const { slug } = deleteModal;
        
        if (!slug) {
            setError('Invalid link');
            setDeleteModal({ isOpen: false, slug: null, repoName: '' });
            return;
        }
        
        setDeleteModal({ isOpen: false, slug: null, repoName: '' });
        setDeleting(true);
        
        try {
            const res = await fetch(`/api/links/${slug}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (res.ok) {
                setSuccess('✅ Link deleted successfully');
                fetchUserAndLinks();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to delete');
                setTimeout(() => setError(''), 3000);
            }
        } catch (err) {
            setError('Something went wrong');
            setTimeout(() => setError(''), 3000);
        } finally {
            setDeleting(false);
        }
    };
    
    const handleCloseDeleteModal = () => {
        setDeleteModal({ isOpen: false, slug: null, repoName: '' });
    };
    
    const handleRefreshClick = (slug, repoName) => {
        if (!slug) {
            setError('Invalid link');
            return;
        }
        setRefreshModal({ isOpen: true, slug, repoName });
    };
    
    const handleConfirmRefresh = async () => {
        const { slug, repoName } = refreshModal;
        
        if (!slug) {
            setError('Invalid link');
            setRefreshModal({ isOpen: false, slug: null, repoName: '' });
            return;
        }
        
        setRefreshModal({ isOpen: false, slug: null, repoName: '' });
        setRefreshing(slug);
        setError('');
        setSuccess('');
        
        try {
            const res = await fetch(`/api/links/${slug}/refresh`, { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                setSuccess(`🔄 Refresh started for ${repoName}. Latest changes will be available shortly.`);
                setTimeout(() => {
                    fetchUserAndLinks();
                    setTimeout(() => setSuccess(''), 3000);
                }, 3000);
            } else {
                setError(data.error || 'Failed to refresh');
                setTimeout(() => setError(''), 5000);
            }
        } catch (err) {
            setError('Something went wrong');
            setTimeout(() => setError(''), 5000);
        } finally {
            setRefreshing(null);
        }
    };
    
    const handleCloseRefreshModal = () => {
        setRefreshModal({ isOpen: false, slug: null, repoName: '' });
    };
    
    const handleCopyUrl = (url) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };
    
    const handleDownloadZip = async (slug, repoName) => {
        setDownloading(slug);
        try {
            const response = await fetch(`/api/links/${slug}/download-zip`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
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
            
            setSuccess('✅ Download started!');
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
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            </Layout>
        );
    }
    
    const activeLinks = links.filter(l => new Date(l.expires_at) > new Date());
    
    return (
        <Layout user={user} onLogout={() => setUser(null)}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">📊 Dashboard</h1>
                    {user && (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-gray-600 text-sm">{user.email}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.is_premium ? 'bg-yellow-500 text-gray-900' : 'bg-gray-200 text-gray-700'}`}>
                                {user.is_premium ? '⭐ Premium' : 'Free Plan'}
                            </span>
                            {!user.is_premium && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">
                                    📌 {activeLinks.length} / {user.limits?.maxLinks || 5} links used
                                </span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Alerts */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                        {success}
                    </div>
                )}
                
                {/* Create Link Form */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">✨ Create New Repository Link</h2>
                    <form onSubmit={handleCreateLink} className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="https://github.com/username/repository"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                            disabled={creating}
                        />
                        <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50" disabled={creating}>
                            {creating ? '⏳ Validating...' : '🚀 Create Link'}
                        </button>
                    </form>
                    <p className="text-xs text-gray-500 mt-3">
                        💡 Public repos only. Max {user?.limits?.maxRepoSizeMB || 100}MB. Expires in {user?.limits?.expiryDays || 7} days.
                    </p>
                </div>
                
                {/* Links List */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">📋 Your Links</h2>
                    {links.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                            No links yet. Create your first link above!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {links.map((link) => {
                                const isExpired = new Date(link.expires_at) < new Date();
                                const isReady = link.status === 'ready' && !isExpired && link.gist_url;
                                
                                return (
                                    <div key={link.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
                                        <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                                            <h3 className="font-semibold text-gray-800 text-lg">{link.repo_name}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                link.status === 'ready' ? 'bg-green-100 text-green-700' :
                                                link.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                link.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                                {link.status === 'ready' ? '✅ Ready' : 
                                                 link.status === 'processing' ? '🔄 Processing' : 
                                                 link.status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                                            </span>
                                        </div>
                                        
                                        <p className="text-gray-500 text-sm mb-3 break-all">{link.repo_url}</p>
                                        
                                        <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-4">
                                            <span>📄 {link.file_count || 0} files</span>
                                            <span>👁️ {link.view_count || 0} views</span>
                                            <span>📅 Expires: {new Date(link.expires_at).toLocaleDateString()}</span>
                                            {link.last_fetched_at && (
                                                <span>🔄 Last updated: {new Date(link.last_fetched_at).toLocaleString()}</span>
                                            )}
                                        </div>
                                        
                                        {isExpired && (
                                            <div className="mb-3 p-2 bg-gray-100 text-gray-600 rounded text-sm">⚠️ This link has expired</div>
                                        )}
                                        
                                        {isReady && link.gist_url && (
                                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                                    <span className="text-sm font-medium text-blue-800">🤖 AI-Readable URL</span>
                                                    <span className="text-xs text-blue-600">Share with DeepSeek, ChatGPT or Claude</span>
                                                </div>
                                                <code className="block text-xs bg-white p-2 rounded border border-blue-200 break-all font-mono mb-2">{link.gist_url}</code>
                                                <button onClick={() => handleCopyUrl(link.gist_url)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition">
                                                    {copiedUrl === link.gist_url ? '✓ Copied!' : '📋 Copy URL'}
                                                </button>
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-wrap gap-3">
                                            {isReady && (
                                                <>
                                                    <a 
                                                        href={link.gist_url} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded text-sm transition"
                                                    >
                                                        📖 View AI Code
                                                    </a>
                                                    <button 
                                                        onClick={() => handleDownloadZip(link.slug, link.repo_name)}
                                                        disabled={downloading === link.slug}
                                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
                                                    >
                                                        {downloading === link.slug ? '⏳ Creating ZIP...' : '📦 Download Code'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRefreshClick(link.slug, link.repo_name)}
                                                        disabled={refreshing === link.slug}
                                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
                                                    >
                                                        {refreshing === link.slug ? '⏳ Refreshing...' : '🔄 Refresh'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClick(link.slug, link.repo_name)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm transition"
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </>
                                            )}
                                            {!isReady && link.status === 'processing' && (
                                                <div className="text-yellow-600 text-sm">⏳ Processing in progress...</div>
                                            )}
                                            {!isReady && link.status === 'failed' && (
                                                <div className="text-red-600 text-sm">❌ Failed: {link.last_error}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Delete Confirmation Modal */}
            <DeleteModal
                isOpen={deleteModal.isOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                repoName={deleteModal.repoName}
            />
            
            {/* Refresh Confirmation Modal */}
            <RefreshModal
                isOpen={refreshModal.isOpen}
                onClose={handleCloseRefreshModal}
                onConfirm={handleConfirmRefresh}
                repoName={refreshModal.repoName}
            />
        </Layout>
    );
}