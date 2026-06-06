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

export async function deleteFromSupabase(slug) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    const filePath = `${cleanSlug}/index.md`;
    
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);
    
    if (error) throw error;
    return { success: true };
}

export function getPublicUrl(slug) {
    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
    const filePath = `${cleanSlug}/index.md`;
    
    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
    
    return data.publicUrl;
}