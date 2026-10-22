// components/RepoTreePicker.js
import React, { useState, useMemo, useCallback } from 'react';

// VS Code-style file type icon generator
function FileIcon({ name, isDirectory, isOpen }) {
    if (isDirectory) {
        if (isOpen) {
            return (
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v2H4v8h16v-6h2v6a2 2 0 01-2 2z"/>
                </svg>
            );
        }
        return (
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/>
            </svg>
        );
    }

    const ext = name.split('.').pop().toLowerCase();
    
    // Python
    if (ext === 'py') {
        return (
            <svg className="w-4 h-4 text-sky-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.92 2c-3.53 0-3.32 1.53-3.32 1.53l.01 1.59h3.37v.48H7.23s-2.23.25-2.23 3.33c0 3.08 1.95 2.97 1.95 2.97h1.16v-1.64s-.06-1.95 1.92-1.95h3.3c1.93 0 1.93-1.85 1.93-1.85V3.88s.27-1.88-3.34-1.88zm-1.82 1.03a.62.62 0 110 1.24.62.62 0 010-1.24zm2.14 17.94c3.53 0 3.32-1.53 3.32-1.53l-.01-1.59h-3.37v-.48h4.75s2.23-.25 2.23-3.33c0-3.08-1.95-2.97-1.95-2.97h-1.16v1.64s.06 1.95-1.92 1.95h-3.3c-1.93 0-1.93 1.85-1.93 1.85v2.58s-.27 1.88 3.34 1.88zm1.82-1.03a.62.62 0 110-1.24.62.62 0 010 1.24z"/>
            </svg>
        );
    }

    // JavaScript / JSX / MJS
    if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
        return (
            <span className="w-4 h-4 rounded-xs bg-amber-400 text-slate-950 font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                JS
            </span>
        );
    }

    // TypeScript / TSX
    if (ext === 'ts' || ext === 'tsx') {
        return (
            <span className="w-4 h-4 rounded-xs bg-sky-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                TS
            </span>
        );
    }

    // C / C++
    if (ext === 'c' || ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'h' || ext === 'hpp') {
        return (
            <span className="w-4 h-4 rounded-xs bg-blue-700 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                C++
            </span>
        );
    }

    // Dart
    if (ext === 'dart') {
        return (
            <span className="w-4 h-4 rounded-xs bg-teal-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                D
            </span>
        );
    }

    // Java
    if (ext === 'java') {
        return (
            <span className="w-4 h-4 rounded-xs bg-red-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                JV
            </span>
        );
    }

    // C#
    if (ext === 'cs') {
        return (
            <span className="w-4 h-4 rounded-xs bg-purple-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                C#
            </span>
        );
    }

    // HTML
    if (ext === 'html' || ext === 'htm') {
        return (
            <span className="w-4 h-4 rounded-xs bg-orange-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0 leading-none">
                &lt;&gt;
            </span>
        );
    }

    // CSS / SCSS
    if (ext === 'css' || ext === 'scss' || ext === 'less') {
        return (
            <span className="w-4 h-4 rounded-xs bg-sky-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                #
            </span>
        );
    }

    // JSON
    if (ext === 'json') {
        return (
            <span className="w-4 h-4 rounded-xs bg-yellow-500 text-slate-900 font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                &#123;&#125;
            </span>
        );
    }

    // Markdown
    if (ext === 'md' || ext === 'markdown') {
        return (
            <span className="w-4 h-4 rounded-xs bg-indigo-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0 leading-none">
                M↓
            </span>
        );
    }

    // Generic file icon
    return (
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
    );
}

// Format bytes into human readable size
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Builds nested hierarchy from a flat list of items
 */
function buildTreeStructure(items) {
    const root = { name: '', path: '', isDirectory: true, children: {}, files: [] };
    
    for (const item of items) {
        const parts = item.path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join('/');

            if (isLast && item.type !== 'tree') {
                current.files.push({
                    ...item,
                    name: part,
                    path: currentPath,
                    isDirectory: false,
                });
            } else {
                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        path: currentPath,
                        isDirectory: true,
                        children: {},
                        files: [],
                    };
                }
                current = current.children[part];
            }
        }
    }

    return root;
}

export default function RepoTreePicker({
    tree = [],
    selectedPaths = [],
    onSelectionChange = null,
    readOnly = false,
    maxHeight = '420px',
}) {
    const [filterQuery, setFilterQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState(() => new Set());

    // Selected paths set for O(1) checks
    const selectedSet = useMemo(() => new Set(selectedPaths || []), [selectedPaths]);

    // All valid file items in tree
    const allFiles = useMemo(() => tree.filter(t => t.type !== 'tree'), [tree]);

    // Initialize root-level folders as expanded by default
    useMemo(() => {
        const initial = new Set();
        for (const item of tree) {
            const parts = item.path.split('/');
            if (parts.length > 1) {
                initial.add(parts[0]);
            }
        }
        setExpandedFolders(initial);
    }, [tree]);

    const toggleFolder = useCallback((folderPath) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderPath)) {
                next.delete(folderPath);
            } else {
                next.add(folderPath);
            }
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        const allDirs = new Set();
        for (const item of tree) {
            const parts = item.path.split('/');
            for (let i = 1; i < parts.length; i++) {
                allDirs.add(parts.slice(0, i).join('/'));
            }
        }
        setExpandedFolders(allDirs);
    }, [tree]);

    const collapseAll = useCallback(() => {
        setExpandedFolders(new Set());
    }, []);

    const selectAll = useCallback(() => {
        if (!onSelectionChange) return;
        const includablePaths = allFiles.filter(f => f.isIncludable !== false).map(f => f.path);
        onSelectionChange(includablePaths);
    }, [allFiles, onSelectionChange]);

    const deselectAll = useCallback(() => {
        if (!onSelectionChange) return;
        onSelectionChange([]);
    }, [onSelectionChange]);

    const handleFileToggle = useCallback((filePath) => {
        if (readOnly || !onSelectionChange) return;
        const next = new Set(selectedSet);
        if (next.has(filePath)) {
            next.delete(filePath);
        } else {
            next.add(filePath);
        }
        onSelectionChange(Array.from(next));
    }, [readOnly, onSelectionChange, selectedSet]);

    const handleFolderToggle = useCallback((folderPath, allDescendantFiles) => {
        if (readOnly || !onSelectionChange) return;
        const next = new Set(selectedSet);
        
        // Check if all descendant files are currently selected
        const areAllSelected = allDescendantFiles.length > 0 && allDescendantFiles.every(f => next.has(f.path));

        if (areAllSelected) {
            // Deselect all descendants
            for (const f of allDescendantFiles) {
                next.delete(f.path);
            }
            next.delete(folderPath);
        } else {
            // Select all includable descendants
            for (const f of allDescendantFiles) {
                if (f.isIncludable !== false) {
                    next.add(f.path);
                }
            }
            next.add(folderPath);
        }

        onSelectionChange(Array.from(next));
    }, [readOnly, onSelectionChange, selectedSet]);

    // Build the hierarchical tree
    const rootNode = useMemo(() => buildTreeStructure(tree), [tree]);

    // Recursive helper to get all descendant files of a directory node
    const getDescendants = (node) => {
        let list = [...node.files];
        for (const child of Object.values(node.children)) {
            list = list.concat(getDescendants(child));
        }
        return list;
    };

    // Render tree node recursively
    const renderNode = (node, depth = 0) => {
        const sortedChildDirNames = Object.keys(node.children).sort();
        const sortedFiles = [...node.files].sort((a, b) => a.name.localeCompare(b.name));

        const elements = [];

        // 1. Render Subdirectories
        for (const dirName of sortedChildDirNames) {
            const childDir = node.children[dirName];
            const isExpanded = expandedFolders.has(childDir.path);
            const descendants = getDescendants(childDir);
            
            // Filter match check
            if (filterQuery) {
                const query = filterQuery.toLowerCase();
                const hasMatchingDescendant = descendants.some(d => d.path.toLowerCase().includes(query));
                if (!hasMatchingDescendant) continue;
            }

            const selectedDescendantsCount = descendants.filter(d => selectedSet.has(d.path)).length;
            const isAllSelected = descendants.length > 0 && selectedDescendantsCount === descendants.length;
            const isIndeterminate = selectedDescendantsCount > 0 && selectedDescendantsCount < descendants.length;

            elements.push(
                <div key={childDir.path} className="select-none">
                    <div 
                        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs hover:bg-slate-100 transition cursor-pointer group ${
                            isIndeterminate || isAllSelected ? 'bg-indigo-50/50' : ''
                        }`}
                        style={{ paddingLeft: `${Math.max(8, depth * 16 + 8)}px` }}
                    >
                        {/* Expand/Collapse Chevron */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFolder(childDir.path);
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-700 transition"
                        >
                            <svg 
                                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* Folder Checkbox (Interactive only if !readOnly) */}
                        {!readOnly && (
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                ref={el => {
                                    if (el) el.indeterminate = isIndeterminate;
                                }}
                                onChange={() => handleFolderToggle(childDir.path, descendants)}
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                        )}

                        {/* Folder Icon + Name */}
                        <div 
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                            onClick={() => toggleFolder(childDir.path)}
                        >
                            <FileIcon name={childDir.name} isDirectory={true} isOpen={isExpanded} />
                            <span className="font-semibold text-slate-800 truncate font-mono text-[12px]">
                                {childDir.name}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">
                                ({selectedDescendantsCount}/{descendants.length})
                            </span>
                        </div>
                    </div>

                    {/* Children Container */}
                    {isExpanded && renderNode(childDir, depth + 1)}
                </div>
            );
        }

        // 2. Render Files in current folder
        for (const file of sortedFiles) {
            if (filterQuery && !file.path.toLowerCase().includes(filterQuery.toLowerCase())) {
                continue;
            }

            const isSelected = selectedSet.has(file.path);
            const isExcluded = file.isIncludable === false;

            elements.push(
                <div
                    key={file.path}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs hover:bg-slate-100 transition select-none ${
                        isSelected ? 'bg-indigo-50/70 text-indigo-900' : 'text-slate-700'
                    } ${isExcluded ? 'opacity-50' : ''}`}
                    style={{ paddingLeft: `${Math.max(8, depth * 16 + 24)}px` }}
                >
                    {/* File Checkbox */}
                    {!readOnly && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isExcluded}
                            onChange={() => handleFileToggle(file.path)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                        />
                    )}

                    {/* File Icon */}
                    <FileIcon name={file.name} isDirectory={false} />

                    {/* File Name */}
                    <span 
                        onClick={() => !readOnly && !isExcluded && handleFileToggle(file.path)}
                        className={`truncate flex-1 font-mono text-[12px] ${
                            isExcluded ? 'line-through text-slate-400' : 'cursor-pointer'
                        }`}
                        title={file.path}
                    >
                        {file.name}
                    </span>

                    {/* File Size & Excluded Badges */}
                    {isExcluded ? (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-sans">
                            Excluded
                        </span>
                    ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                            {formatBytes(file.size)}
                        </span>
                    )}
                </div>
            );
        }

        return elements;
    };

    const selectedCount = allFiles.filter(f => selectedSet.has(f.path)).length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs text-left">
            {/* Header & Controls Toolbar */}
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span>Repository Tree</span>
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-[11px]">
                        {selectedCount} / {allFiles.length} files selected
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                    {!readOnly && (
                        <>
                            <button
                                type="button"
                                onClick={selectAll}
                                className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition cursor-pointer text-[11px]"
                            >
                                Select All
                            </button>
                            <button
                                type="button"
                                onClick={deselectAll}
                                className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition cursor-pointer text-[11px]"
                            >
                                Deselect All
                            </button>
                            <span className="text-slate-300">|</span>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={expandAll}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition cursor-pointer text-[11px]"
                    >
                        Expand All
                    </button>
                    <button
                        type="button"
                        onClick={collapseAll}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition cursor-pointer text-[11px]"
                    >
                        Collapse All
                    </button>
                </div>
            </div>

            {/* Quick Filter Box */}
            <div className="p-2 border-b border-slate-100 bg-white">
                <input
                    type="text"
                    placeholder="Filter files by name or path (e.g. src/index.ts)..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition font-mono"
                />
            </div>

            {/* Tree Viewport */}
            <div 
                className="p-2 overflow-y-auto space-y-0.5 divide-y divide-transparent"
                style={{ maxHeight }}
            >
                {tree.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                        No repository tree metadata available.
                    </div>
                ) : (
                    renderNode(rootNode, 0)
                )}
            </div>
        </div>
    );
}
