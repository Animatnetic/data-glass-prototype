import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ScrapeRecord {
  id: string;
  created_at: string;
  target_url: string;
  user_query: string;
  results: any[];
  preview_data: any[];
  status: string;
  error_message?: string;
}