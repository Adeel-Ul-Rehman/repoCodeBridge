// components/DeleteModal.js
import React from 'react';

export default function DeleteModal({ isOpen, onClose, onConfirm, repoName }) {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 transform transition-all">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">🗑️ Delete Link</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-5">
                    <p className="text-gray-600">Are you sure you want to delete this link?</p>
                    <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">Repository:</p>
                        <p className="font-mono text-sm text-gray-800 break-all">{repoName}</p>
                    </div>
                    <p className="mt-4 text-xs text-red-500">⚠️ This action cannot be undone. The AI-readable URL will stop working immediately.</p>
                </div>
                
                <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition">
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    );
}