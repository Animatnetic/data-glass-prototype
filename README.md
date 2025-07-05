# DataGlass - Intelligent Web Scraping Platform

DataGlass is a modern, serverless web scraping application built with React and Supabase. It allows users to extract data from any website using natural language queries.

## Features

- **Natural Language Queries**: Describe what you want to extract in plain English
- **User Authentication**: Secure sign-in with email and password
- **Database History**: Your scraping history is saved to your account (with local fallback)
- **Serverless Edge Computing**: Fast, scalable scraping powered by Supabase Edge Functions
- **Interactive Data Tables**: View and filter extracted data with advanced table features
- **Multiple Export Formats**: Download data as JSON, CSV, or Markdown
- **Persistent History**: Access and restore previous scraping sessions
- **Glassmorphism UI**: Beautiful, modern interface with frosted glass effects

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (Database, Authentication, Edge Functions)
- **Data Processing**: Deno with HTML parsing and AI-powered extraction
- **UI Components**: React Table, Syntax Highlighter, Lucide Icons

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Set up Supabase for full functionality:
   - Click the "Connect to Supabase" button in the top right corner of the application
   - This will automatically configure your Supabase connection and deploy Edge Functions
   - Alternatively, create a new Supabase project manually:
     - Go to https://supabase.com and create a new project
     - Navigate to 'Project Settings' -> 'API'
     - Copy your Project URL and anon/public key
     - Update the `.env` file with your credentials
     - Run the SQL migration in `supabase/migrations/`
     - Deploy the Edge Functions (convert-query and execute-scrape)
     - Set up the required secrets in your Supabase project:
       - OPENAI_API_KEY: Your OpenAI API key
       - FIRECRAWL_API_KEY: Your Firecrawl API key

## Usage

1. **Sign Up/Sign In**: Create an account or sign in to save your scraping history
2. Enter a target URL (e.g., `https://example.com`) 
3. Describe what you want to extract (e.g., "all headlines", "product prices")
4. Click "Extract Data" to start the scraping process
5. View results in an interactive table or JSON format
6. Download data as JSON, CSV, or Markdown
7. Access previous scrapes through the History panel

## Features

### Local Mode (No Setup Required)
- Simple web scraping using CORS proxy
- Basic content extraction (headlines, links, text)
- Export to JSON, CSV, and Markdown
- Local history storage in browser
- Works immediately without any configuration

### Full Mode (Requires Supabase Setup)
- User authentication and account management
- AI-powered extraction using OpenAI and Firecrawl
- Natural language query processing
- Database-stored scraping history
- Advanced data processing and extraction
- Serverless Edge Functions for scalable processing

## Architecture

- **Frontend**: React SPA with glassmorphism UI
- **Authentication**: Supabase Auth with email/password
- **Database**: PostgreSQL for storing user profiles and scrape history
- **Edge Functions**: Deno-based serverless functions for AI-powered scraping
- **Storage**: Database for authenticated users, localStorage for guests
- **Deployment**: Vercel for frontend, Supabase for backend

## Database Schema

The application uses two main tables:
- `user_profiles`: User account information
- `scrapes`: Scraping history and results

Row Level Security (RLS) ensures users can only access their own data.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details