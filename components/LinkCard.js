// components/LinkCard.js
import React from 'react';

export default function LinkCard({ link, onDelete }) {
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    };
    
    const getStatusBadge = () => {
        switch(link.status) {
            case 'ready':
                return <span style={styles.badgeSuccess}>✅ Ready</span>;
            case 'processing':
                return <span style={styles.badgeWarning}>🔄 Processing</span>;
            case 'failed':
                return <span style={styles.badgeError}>❌ Failed</span>;
            default:
                return <span style={styles.badgeInfo}>⏳ Pending</span>;
        }
    };
    
    const isExpired = new Date(link.expires_at) < new Date();
    
    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <h3 style={styles.repoName}>{link.repo_name}</h3>
                {getStatusBadge()}
            </div>
            
            <p style={styles.repoUrl}>{link.repo_url}</p>
            
            <div style={styles.stats}>
                <span>📄 {link.file_count || 0} files</span>
                <span>👁️ {link.view_count || 0} views</span>
                <span>📅 Expires: {formatDate(link.expires_at)}</span>
            </div>
            
            {isExpired && (
                <div style={styles.expiredMsg}>⚠️ This link has expired</div>
            )}
            
            {link.status === 'ready' && !isExpired && (
                <div style={styles.actions}>
                    <a 
                        href={`/api/links/${link.slug}?raw=true`}
                        target="_blank"
                        style={styles.viewBtn}
                    >
                        📖 View AI Code
                    </a>
                    <a 
                        href={link.gist_url}
                        target="_blank"
                        style={styles.gistBtn}
                    >
                        🔗 Gist URL
                    </a>
                    <button 
                        onClick={() => onDelete(link.slug)}
                        style={styles.deleteBtn}
                    >
                        🗑️ Delete
                    </button>
                </div>
            )}
            
            {link.status === 'processing' && (
                <div style={styles.processingMsg}>
                    ⏳ Processing repository... This may take a few minutes.
                </div>
            )}
            
            {link.status === 'failed' && (
                <div style={styles.failedMsg}>
                    ❌ Failed: {link.last_error}
                </div>
            )}
        </div>
    );
}

const styles = {
    card: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '15px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    repoName: {
        margin: 0,
        fontSize: '18px',
        color: '#2c3e50',
    },
    repoUrl: {
        color: '#666',
        fontSize: '14px',
        marginBottom: '10px',
        wordBreak: 'break-all',
    },
    stats: {
        display: 'flex',
        gap: '15px',
        fontSize: '12px',
        color: '#888',
        marginBottom: '15px',
    },
    actions: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
    },
    viewBtn: {
        backgroundColor: '#3498db',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        textDecoration: 'none',
        fontSize: '13px',
    },
    gistBtn: {
        backgroundColor: '#28a745',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        textDecoration: 'none',
        fontSize: '13px',
    },
    deleteBtn: {
        backgroundColor: '#e74c3c',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '13px',
    },
    badgeSuccess: { fontSize: '12px' },
    badgeWarning: { fontSize: '12px' },
    badgeError: { fontSize: '12px' },
    badgeInfo: { fontSize: '12px' },
    processingMsg: {
        backgroundColor: '#fff3cd',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#856404',
    },
    failedMsg: {
        backgroundColor: '#f8d7da',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#721c24',
    },
    expiredMsg: {
        backgroundColor: '#e2e3e5',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#383d41',
        marginBottom: '10px',
    },
};