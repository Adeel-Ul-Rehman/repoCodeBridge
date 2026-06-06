// components/RefreshModal.js
import React from 'react';

export default function RefreshModal({ isOpen, onClose, onConfirm, repoName }) {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 transform transition-all">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">🔄 Refresh Repository</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-5">
                    <p className="text-gray-600 mb-3">Are you sure you want to refresh this repository?</p>
                    <div className="bg-yellow-50 p-3 rounded-lg mb-3">
                        <p className="text-sm text-yellow-800 flex items-center gap-2">
                            <span>🔄</span> This will fetch the latest changes from GitHub
                        </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-700">Repository: <strong className="font-mono">{repoName}</strong></p>
                    </div>
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 flex items-center gap-2">
                            <span>✅</span> The AI-readable link will stay the same
                        </p>
                    </div>
                    <p className="mt-4 text-xs text-gray-500">This may take a few moments depending on repository size.</p>
                </div>
                
                <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition flex items-center gap-2">
                        <span>🔄</span> Yes, Refresh
                    </button>
                </div>
            </div>
        </div>
    );
}