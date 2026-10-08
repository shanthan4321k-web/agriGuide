// =============================================================================
// AGRIGUIDE CACHE & OFFLINE MANAGER
// =============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const CacheService = {
  set<T>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(`agriguide_cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.warn('[CacheService] Failed to cache data:', e);
    }
  },

  get<T>(key: string): { data: T; timestamp: number } | null {
    try {
      const raw = localStorage.getItem(`agriguide_cache_${key}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[CacheService] Failed to read cache:', e);
      return null;
    }
  },

  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  formatTimeAgo(timestamp: number, lang: 'en' | 'te' | 'hi' = 'en'): string {
    const elapsedMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (elapsedMinutes < 1) {
      return lang === 'te' ? 'ఇప్పుడే' : lang === 'hi' ? 'अभी-अभी' : 'just now';
    }
    if (elapsedMinutes < 60) {
      return `${elapsedMinutes} ${lang === 'te' ? 'నిమి క్రితం' : lang === 'hi' ? 'मिनट पहले' : 'min ago'}`;
    }
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    return `${elapsedHours} ${lang === 'te' ? 'గంటల క్రితం' : lang === 'hi' ? 'घंटे पहले' : 'h ago'}`;
  }
};
