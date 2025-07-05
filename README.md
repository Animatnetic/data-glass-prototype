# DataGlass - Intelligent Web Scraping Platform

DataGlass is a modern web scraping application built with React. It allows users to extract data from any website using natural language queries with local history storage.

## Features

- **Natural Language Queries**: Describe what you want to extract in plain English
- **Local History Storage**: Your scraping history is saved locally in your browser
- **Interactive Data Tables**: View and filter extracted data with advanced table features
- **Multiple Export Formats**: Download data as JSON or PDF
- **Persistent History**: Access and restore previous scraping sessions stored locally
- **Glassmorphism UI**: Beautiful, modern interface with frosted glass effects

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Storage**: Local Storage for history persistence
- **Data Processing**: Deno with HTML parsing
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

4. (Optional) Set up advanced AI-powered scraping:
   - Deploy the Edge Functions from the `/edge-functions` directory to a serverless platform
   - Set up environment variables for your deployed functions
   - Configure VITE_EDGE_FUNCTION_URL and VITE_EDGE_FUNCTION_KEY in your .env file

## Usage

1. Enter a target URL (e.g., `https://example.com`) 
2. Describe what you want to extract (e.g., "all headlines", "product prices")
3. Click "Extract Data" to start the scraping process
4. View results in an interactive table or JSON format
5. Download data as JSON, CSV, or Markdown
6. Access previous scrapes through the History panel (stored locally)

## Features

### Local Mode (No Setup Required)
- Simple web scraping using CORS proxy
- Basic content extraction (headlines, links, text)
- Export to JSON, CSV, and Markdown
- Local history storage in browser
- Works immediately without any configuration

### Advanced Mode (Requires Edge Function Setup)
- AI-powered extraction using deployed Edge Functions
- Natural language query processing
- Advanced data processing and extraction
- Serverless Edge Functions for scalable processing

## Architecture

- **Frontend**: React SPA with glassmorphism UI
- **Storage**: Browser Local Storage for history
- **Edge Functions**: Optional Deno-based serverless functions for advanced scraping
- **Deployment**: Static hosting for frontend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
