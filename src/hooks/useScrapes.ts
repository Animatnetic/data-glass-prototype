import { useState, useEffect } from 'react';
import { supabase, ScrapeRecord } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useScrapes = () => {
  const { user } = useAuth();
  const [scrapes, setScrapes] = useState<ScrapeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchScrapes();
    } else {
      setScrapes([]);
    }
  }, [user]);

  const fetchScrapes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scrapes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching scrapes:', error);
        return;
      }

      setScrapes(data || []);
    } catch (error) {
      console.error('Error fetching scrapes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createScrape = async (
    targetUrls: string[],
    userQuery: string,
    results: any[] = [],
    previewData: any[] = []
  ) => {
    if (!user) return { error: new Error('No user logged in') };

    const scrapeData = {
      user_id: user.id,
      target_urls: targetUrls,
      user_query: userQuery,
      results: results,
      preview_data: previewData,
      status: results.length > 0 ? 'completed' : 'pending' as const,
      total_items: results.length,
    };

    const { data, error } = await supabase
      .from('scrapes')
      .insert(scrapeData)
      .select()
      .single();

    if (!error && data) {
      setScrapes(prev => [data, ...prev]);
    }

    return { data, error };
  };

  const updateScrape = async (
    id: string,
    updates: Partial<ScrapeRecord>
  ) => {
    if (!user) return { error: new Error('No user logged in') };

    const { data, error } = await supabase
      .from('scrapes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (!error && data) {
      setScrapes(prev => 
        prev.map(scrape => scrape.id === id ? data : scrape)
      );
    }

    return { data, error };
  };

  const deleteScrape = async (id: string) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('scrapes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      setScrapes(prev => prev.filter(scrape => scrape.id !== id));
    }

    return { error };
  };

  return {
    scrapes,
    loading,
    fetchScrapes,
    createScrape,
    updateScrape,
    deleteScrape,
  };
};