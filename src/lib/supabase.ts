import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapeRecord {
  id: string;
  user_id: string;
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