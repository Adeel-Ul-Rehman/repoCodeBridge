// utils/supabaseStorage.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'ai-readable-code';

export async function uploadToSupabase(slug, content) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    const filePath = `${cleanSlug}/index.md`;
    
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, content, {
            contentType: 'text/markdown',
            cacheControl: '3600',
            upsert: true,
        });
    
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
    
    return {
        success: true,
        key: filePath,
        publicUrl: publicUrlData.publicUrl,
    };
}

export async function uploadSnapshot(slug, snapshotData) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    const filePath = `${cleanSlug}/snapshot.json`;
    const content = typeof snapshotData === 'string' ? snapshotData : JSON.stringify(snapshotData);
    
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, content, {
            contentType: 'application/json',
            cacheControl: '3600',
            upsert: true,
        });
    
    if (error) {
        console.warn(`[SupabaseStorage] Could not persist snapshot: ${error.message}`);
    }
}

export async function getSnapshot(slug) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    const filePath = `${cleanSlug}/snapshot.json`;
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(filePath);
        if (error || !data) return null;
        const text = await data.text();
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export async function deleteFromSupabase(slug) {
    return deleteAllLinkObjects(slug);
}

export async function deleteAllLinkObjects(slug) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    let filesToDelete = [
        `${cleanSlug}/index.md`,
        `${cleanSlug}/snapshot.json`,
        `${cleanSlug}/tree.json`,
        `${cleanSlug}/source.zip`,
    ];
    
    try {
        const { data: listedFiles } = await supabase.storage
            .from(BUCKET_NAME)
            .list(cleanSlug);
        
        if (listedFiles && Array.isArray(listedFiles)) {
            for (const f of listedFiles) {
                if (f.name) {
                    filesToDelete.push(`${cleanSlug}/${f.name}`);
                }
            }
        }
    } catch (listErr) {
        // Fall back to deleting the known file list
    }

    const uniquePaths = Array.from(new Set(filesToDelete));
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(uniquePaths);
    
    if (error) {
        throw error;
    }
    return { success: true, deletedCount: uniquePaths.length };
}

export function getPublicUrl(slug) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    const filePath = `${cleanSlug}/index.md`;
    
    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
    
    return data.publicUrl;
}