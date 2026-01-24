/**
 * Contract Analysis Caching Utility
 *
 * Caches contract fetch + analysis results in browser localStorage to avoid
 * expensive API calls (~30-40s, ~25-30k tokens each time).
 *
 * Cache structure:
 * - Keyed by contract file ID + modified time (auto-invalidates on file update)
 * - Stores both raw content and analyzed terms
 * - Includes metadata for debugging
 */

import type { ExtractedContractTerms } from '@/types/contract';

export interface CachedContractData {
  // File metadata
  fileId: string;
  fileName: string;
  modifiedTime: string;  // ISO timestamp from Google Drive

  // Fetched content
  content: string;
  contentType: 'pdf' | 'text';

  // Analyzed terms
  terms: ExtractedContractTerms;

  // Cache metadata
  cachedAt: string;  // ISO timestamp when cached
  version: number;   // Cache schema version for migrations
}

const CACHE_KEY_PREFIX = 'dispatcher_contract_';
const CACHE_VERSION = 1;

/**
 * Generate cache key from file metadata
 * Key format: dispatcher_contract_{fileId}_{modifiedTime}
 * This ensures cache invalidates when file is updated in Google Drive
 */
function getCacheKey(fileId: string, modifiedTime: string): string {
  // Use modified time as part of key for auto-invalidation
  const timestamp = new Date(modifiedTime).getTime();
  return `${CACHE_KEY_PREFIX}${fileId}_${timestamp}`;
}

/**
 * Save contract analysis to cache
 */
export function saveCachedContract(data: Omit<CachedContractData, 'cachedAt' | 'version'>): void {
  try {
    const cacheData: CachedContractData = {
      ...data,
      cachedAt: new Date().toISOString(),
      version: CACHE_VERSION,
    };

    const cacheKey = getCacheKey(data.fileId, data.modifiedTime);
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    // Also save a "latest" pointer for quick access
    localStorage.setItem(`${CACHE_KEY_PREFIX}latest`, cacheKey);

    console.log('[ContractCache] Saved contract to cache:', {
      fileName: data.fileName,
      fileId: data.fileId,
      modifiedTime: data.modifiedTime,
      cacheKey,
    });
  } catch (error) {
    console.error('[ContractCache] Failed to save to cache:', error);
    // Don't throw - caching is optional, workflow should continue
  }
}

/**
 * Load contract analysis from cache
 * Returns null if no cache found or cache is invalid
 */
export function loadCachedContract(): CachedContractData | null {
  try {
    // Get the latest cache key
    const latestKey = localStorage.getItem(`${CACHE_KEY_PREFIX}latest`);
    if (!latestKey) {
      console.log('[ContractCache] No cached contract found');
      return null;
    }

    const cached = localStorage.getItem(latestKey);
    if (!cached) {
      console.log('[ContractCache] Cache key exists but data missing');
      return null;
    }

    const data = JSON.parse(cached) as CachedContractData;

    // Validate cache version
    if (data.version !== CACHE_VERSION) {
      console.warn('[ContractCache] Cache version mismatch, invalidating');
      clearContractCache();
      return null;
    }

    console.log('[ContractCache] Loaded contract from cache:', {
      fileName: data.fileName,
      fileId: data.fileId,
      cachedAt: data.cachedAt,
      age: `${Math.round((Date.now() - new Date(data.cachedAt).getTime()) / 1000 / 60)}min ago`,
    });

    return data;
  } catch (error) {
    console.error('[ContractCache] Failed to load from cache:', error);
    return null;
  }
}

/**
 * Check if we have a valid cached contract
 */
export function hasCachedContract(): boolean {
  const latestKey = localStorage.getItem(`${CACHE_KEY_PREFIX}latest`);
  if (!latestKey) return false;

  const cached = localStorage.getItem(latestKey);
  return !!cached;
}

/**
 * Clear all contract caches
 */
export function clearContractCache(): void {
  try {
    // Remove all keys with our prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    console.log(`[ContractCache] Cleared ${keysToRemove.length} cached contracts`);
  } catch (error) {
    console.error('[ContractCache] Failed to clear cache:', error);
  }
}

/**
 * Get cache metadata without loading full contract
 */
export function getCacheMetadata(): { fileName: string; cachedAt: string } | null {
  try {
    const latestKey = localStorage.getItem(`${CACHE_KEY_PREFIX}latest`);
    if (!latestKey) return null;

    const cached = localStorage.getItem(latestKey);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedContractData;
    return {
      fileName: data.fileName,
      cachedAt: data.cachedAt,
    };
  } catch {
    return null;
  }
}
