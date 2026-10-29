import { createClient } from '@supabase/supabase-js';

const DEFAULT_BUCKET_NAME = 'student-resumes';

let customClient = null;

/**
 * Returns true if Supabase URL and service role / secret key are present in env.
 */
export const isSupabaseConfigured = () => {
  if (customClient) return true;
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)?.trim();
  return Boolean(url && key);
};

/**
 * Determines whether cloud storage is mandatory (in production, Render, or when explicitly required).
 * If true and Supabase is not configured, uploads will fail safely instead of writing to ephemeral disk.
 */
export const isCloudStorageRequired = () => {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    process.env.REQUIRE_SUPABASE_STORAGE === 'true'
  );
};

export const getBucketName = () => {
  return process.env.SUPABASE_BUCKET_NAME?.trim() || DEFAULT_BUCKET_NAME;
};

/**
 * Returns the Supabase client instance.
 */
export const getSupabaseClient = () => {
  if (customClient) return customClient;
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)?.trim();

  if (!url || !key) {
    throw new Error('Supabase Storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Injects a mock or custom Supabase client (useful for isolated tests).
 */
export const setSupabaseClient = (client) => {
  customClient = client;
};

/**
 * Resets custom client injection.
 */
export const resetSupabaseClient = () => {
  customClient = null;
};

/**
 * Validates that an object path is in the expected safe format (resumes/filename.pdf).
 * Prevents path traversal and arbitrary path injection.
 */
export const isValidStoragePath = (pathStr) => {
  if (typeof pathStr !== 'string' || !pathStr.trim()) return false;
  if (pathStr.includes('..') || pathStr.startsWith('/') || pathStr.includes('\\')) return false;
  return /^resumes\/[a-zA-Z0-9_.-]+\.pdf$/i.test(pathStr);
};

/**
 * Uploads a resume PDF buffer to Supabase Storage.
 *
 * @param {string} storagePath - e.g., 'resumes/resume_user123_170000_123.pdf'
 * @param {Buffer} buffer - PDF binary buffer
 * @param {string} contentType - defaults to 'application/pdf'
 * @returns {Promise<{ success: boolean, error?: any, data?: any }>}
 */
export const uploadResumeToSupabase = async (
  storagePath,
  buffer,
  contentType = 'application/pdf'
) => {
  if (!isValidStoragePath(storagePath)) {
    return { success: false, error: new Error('Invalid storage path specification.') };
  }

  try {
    const supabase = getSupabaseClient();
    const bucket = getBucketName();

    const { data, error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err };
  }
};

/**
 * Downloads a resume PDF buffer from Supabase Storage.
 *
 * @param {string} storagePath - e.g., 'resumes/resume_user123_170000_123.pdf'
 * @returns {Promise<{ success: boolean, error?: any, buffer?: Buffer }>}
 */
export const downloadResumeFromSupabase = async (storagePath) => {
  if (!isValidStoragePath(storagePath)) {
    return { success: false, error: new Error('Invalid storage path specification.') };
  }

  try {
    const supabase = getSupabaseClient();
    const bucket = getBucketName();

    const { data, error } = await supabase.storage.from(bucket).download(storagePath);

    if (error || !data) {
      return { success: false, error: error || new Error('No data returned from storage.') };
    }

    // Convert Blob/Response to Node Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { success: true, buffer };
  } catch (err) {
    return { success: false, error: err };
  }
};

/**
 * Deletes a resume object from Supabase Storage.
 *
 * @param {string} storagePath - e.g., 'resumes/resume_user123_170000_123.pdf'
 * @returns {Promise<{ success: boolean, error?: any, data?: any }>}
 */
export const deleteResumeFromSupabase = async (storagePath) => {
  if (!isValidStoragePath(storagePath)) {
    return { success: false, error: new Error('Invalid storage path specification.') };
  }

  try {
    const supabase = getSupabaseClient();
    const bucket = getBucketName();

    const { data, error } = await supabase.storage.from(bucket).remove([storagePath]);

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err };
  }
};
