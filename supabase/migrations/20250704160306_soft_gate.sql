/*
  # Create scrapes table for DataGlass

  1. New Tables
    - `scrapes`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `target_url` (text)
      - `user_query` (text)
      - `results` (jsonb)
      - `preview_data` (jsonb)
      - `status` (text)
      - `error_message` (text, nullable)

  2. Security
    - Enable RLS on `scrapes` table
    - Add policy for public access (no auth required for demo)

  3. Storage
    - Create bucket for generated files
    - Set appropriate access policies
*/

CREATE TABLE IF NOT EXISTS scrapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  target_url text NOT NULL,
  user_query text NOT NULL,
  results jsonb,
  preview_data jsonb,
  status text DEFAULT 'processing',
  error_message text
);

ALTER TABLE scrapes ENABLE ROW LEVEL SECURITY;

-- Allow public access for demo purposes
CREATE POLICY "Allow public access to scrapes"
  ON scrapes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for generated files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated_files', 'generated_files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Allow public uploads to generated_files"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'generated_files');

CREATE POLICY "Allow public downloads from generated_files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'generated_files');