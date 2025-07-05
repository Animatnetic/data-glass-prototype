# DataGlass - Intelligent Web Scraping Platform

DataGlass is a modern, serverless web scraping application built with React and Supabase. It allows users to extract data from any website using natural language queries.

## Features

- **Natural Language Queries**: Describe what you want to extract in plain English
- **Serverless Edge Computing**: Fast, scalable scraping powered by Supabase Edge Functions
- **Interactive Data Tables**: View and filter extracted data with advanced table features
- **Multiple Export Formats**: Download data as JSON or PDF
- **Scraping History**: Access and restore previous scraping sessions
- **Glassmorphism UI**: Beautiful, modern interface with frosted glass effects

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (Database, Storage, Edge Functions)
- **Data Processing**: Deno with HTML parsing
- **UI Components**: React Table, Syntax Highlighter, Lucide Icons

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Supabase:
   - Click the "Connect to Supabase" button in the top right corner of the application
   - This will automatically configure your Supabase connection
   - Alternatively, create a new Supabase project manually:
     - Go to https://supabase.com and create a new project
     - Navigate to 'Project Settings' -> 'API'
     - Copy your Project URL and anon/public key
   - Run the SQL migration in `supabase/migrations/create_scrapes_table.sql`
   - Deploy the Edge Functions (convert-query and execute-scrape)
   - Set up the required secrets in your Supabase project:
     - OPENAI_API_KEY: Your OpenAI API key
     - FIRECRAWL_API_KEY: Your Firecrawl API key

4. Configure environment variables:
   If you set up Supabase manually, update the `.env` file with your credentials:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key

5. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Enter a target URL (e.g., `https://example.com`)
2. Describe what you want to extract (e.g., "all headlines", "product prices")
3. Click "Extract Data" to start the scraping process
4. View results in an interactive table or JSON format
5. Download data as JSON or PDF
6. Access previous scrapes through the History panel

## Architecture

- **Frontend**: React SPA with glassmorphism UI
- **Edge Functions**: Deno-based serverless functions for scraping and PDF generation
- **Database**: PostgreSQL for storing scrape results
- **Storage**: Supabase Storage for generated files
- **Deployment**: Vercel for frontend, Supabase for backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
