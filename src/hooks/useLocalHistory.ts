import { useState, useEffect } from 'react';

export interface LocalScrapeRecord {
  id: string;
  target_urls: string[];
  user_query: string;
  results: any[];
  preview_data: any[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
  total_items: number;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'dataglass_scrape_history';

export const useLocalHistory = () => {
  const [scrapes, setScrapes] = useState<LocalScrapeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setScrapes(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading scrape history from localStorage:', error);
      setScrapes([]);
    }
  };

  const saveToStorage = (newScrapes: LocalScrapeRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newScrapes));
    } catch (error) {
      console.error('Error saving scrape history to localStorage:', error);
    }
  };

  const createScrape = async (
    targetUrls: string[],
    userQuery: string,
    results: any[] = [],
    previewData: any[] = []
  ) => {
    const newScrape: LocalScrapeRecord = {
      id: `scrape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target_urls: targetUrls,
      user_query: userQuery,
      results: results,
      preview_data: previewData,
      status: results.length > 0 ? 'completed' : 'pending',
      total_items: results.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedScrapes = [newScrape, ...scrapes].slice(0, 50); // Keep only last 50 scrapes
    setScrapes(updatedScrapes);
    saveToStorage(updatedScrapes);

    return { data: newScrape, error: null };
  };

  const updateScrape = async (
    id: string,
    updates: Partial<LocalScrapeRecord>
  ) => {
    const updatedScrapes = scrapes.map(scrape =>
      scrape.id === id
        ? { ...scrape, ...updates, updated_at: new Date().toISOString() }
        : scrape
    );

    setScrapes(updatedScrapes);
    saveToStorage(updatedScrapes);

    const updatedScrape = updatedScrapes.find(s => s.id === id);
    return { data: updatedScrape, error: null };
  };

  const deleteScrape = async (id: string) => {
    const updatedScrapes = scrapes.filter(scrape => scrape.id !== id);
    setScrapes(updatedScrapes);
    saveToStorage(updatedScrapes);

    return { error: null };
  };

  const clearAllScrapes = () => {
    setScrapes([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    scrapes,
    loading,
    createScrape,
    updateScrape,
    deleteScrape,
    clearAllScrapes,
  };
};