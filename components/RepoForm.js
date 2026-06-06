// components/RepoForm.js
import React, { useState } from 'react';

export default function RepoForm({ onSubmit, isLoading, maxSizeMB = 100 }) {
    const [repoUrl, setRepoUrl] = useState('');
    const [error, setError] = useState('');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        
        if (!repoUrl.trim()) {
            setError('Please enter a repository URL');
            return;
        }
        
        if (!repoUrl.includes('github.com')) {
            setError('Please enter a valid GitHub repository URL');
            return;
        }
        
        onSubmit(repoUrl);
        setRepoUrl('');
    };
    
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Create New Repository Link</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
                <input
                    type="text"
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    style={styles.input}
                    disabled={isLoading}
                />
                <button 
                    type="submit" 
                    style={styles.button}
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating...' : 'Create Link'}
                </button>
            </form>
            {error && <p style={styles.error}>{error}</p>}
            <p style={styles.note}>
                💡 Public repos only. Max {maxSizeMB}MB. 
                Free users: 5 active links, 7 days expiry
            </p>
        </div>
    );
}

const styles = {
    container: {
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        marginBottom: '30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    title: {
        marginTop: 0,
        marginBottom: '15px',
        color: '#2c3e50',
    },
    form: {
        display: 'flex',
        gap: '10px',
    },
    input: {
        flex: 1,
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        fontSize: '16px',
    },
    button: {
        backgroundColor: '#3498db',
        color: 'white',
        padding: '12px 24px',
        border: 'none',
        borderRadius: '5px',
        fontSize: '16px',
        cursor: 'pointer',
    },
    error: {
        color: '#e74c3c',
        fontSize: '14px',
        marginTop: '10px',
    },
    note: {
        fontSize: '12px',
        color: '#666',
        marginTop: '10px',
    },
};