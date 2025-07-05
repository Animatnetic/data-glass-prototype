import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Download, 
  FileText, 
  History,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useScrapes } from './hooks/useScrapes';
import { useLocalHistory } from './hooks/useLocalHistory';
import { supabase } from './lib/supabase';
import { DataTable } from './components/DataTable';
import { GlassCard } from './components/GlassCard';
import { JsonViewer } from './components/JsonViewer';
import { LoadingSpinner } from './components/LoadingSpinner';
import { HistoryPanel } from './components/HistoryPanel';
import { downloadCSV, downloadMarkdown } from './utils/exportUtils';
import { ScrapeRecord } from './lib/supabase';
import { LocalScrapeRecord } from './hooks/useLocalHistory';


// Mock data for demonstration
const mockData = [
  { title: "Breaking: Tech Giants Report Record Earnings", url: "https://example.com/news1", category: "Technology", date: "2024-01-15" },
  { title: "Climate Summit Reaches Historic Agreement", url: "https://example.com/news2", category: "Environment", date: "2024-01-14" },
  { title: "New AI Breakthrough in Medical Research", url: "https://example.com/news3", category: "Science", date: "2024-01-13" },
  { title: "Global Markets Show Strong Recovery", url: "https://example.com/news4", category: "Finance", date: "2024-01-12" },
  { title: "Space Mission Discovers New Exoplanet", url: "https://example.com/news5", category: "Space", date: "2024-01-11" }
];


type ViewMode = 'table' | 'json';

interface UrlEntry {
  id: string;
  url: string;
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const { scrapes: dbScrapes, createScrape: createDbScrape, deleteScrape: deleteDbScrape } = useScrapes();
  const { scrapes: localScrapes, createScrape: createLocalScrape, deleteScrape: deleteLocalScrape } = useLocalHistory();
  
  const [urls, setUrls] = useState<UrlEntry[]>([{ id: '1', url: '' }]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Use database scrapes if user is logged in, otherwise use local scrapes
  const scrapes = user && supabase ? dbScrapes : localScrapes;
  const createScrape = user && supabase ? createDbScrape : createLocalScrape;
  const deleteScrape = user && supabase ? deleteDbScrape : deleteLocalScrape;

  const addUrl = () => {
    const newId = Date.now().toString();
    setUrls([...urls, { id: newId, url: '' }]);
  };

  const removeUrl = (id: string) => {
    if (urls.length > 1) {
      setUrls(urls.filter(entry => entry.id !== id));
    }
  };

  const updateUrl = (id: string, newUrl: string) => {
    setUrls(urls.map(entry => 
      entry.id === id ? { ...entry, url: newUrl } : entry
    ));
  };

  const parseCommaUrls = (inputValue: string, entryId: string) => {
    // Check if the input contains commas
    if (inputValue.includes(',')) {
      const urlList = inputValue
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
      
      if (urlList.length > 1) {
        // Find the index of the current entry
        const currentIndex = urls.findIndex(entry => entry.id === entryId);
        
        // Create new URL entries
        const newUrls = urlList.map((url, index) => ({
          id: index === 0 ? entryId : `${Date.now()}-${index}`,
          url: url
        }));
        
        // Replace the current entry and add new ones
        const updatedUrls = [
          ...urls.slice(0, currentIndex),
          ...newUrls,
          ...urls.slice(currentIndex + 1)
        ];
        
        setUrls(updatedUrls);
        return true; // Indicates that parsing occurred
      }
    }
    return false; // No parsing needed
  };

  const handleUrlChange = (id: string, newUrl: string) => {
    // First try to parse comma-separated URLs
    const wasParsed = parseCommaUrls(newUrl, id);
    
    // If not parsed, update normally
    if (!wasParsed) {
      updateUrl(id, newUrl);
    }
  };

  const handleScrape = async () => {
    const validUrls = urls.filter(entry => entry.url.trim() !== '');
    if (validUrls.length === 0 || !query) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Check if Supabase Edge Functions are available
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      let useEdgeFunctions = false;
      
      if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your_supabase_url' && supabaseAnonKey !== 'your_supabase_anon_key') {
        // Test if Edge Functions are available
        try {
          const testResponse = await fetch(`${supabaseUrl}/functions/v1/convert-query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ test: true }),
          });
          
          if (testResponse.status !== 404) {
            useEdgeFunctions = true;
          }
        } catch (error) {
          console.log('Edge Functions not available, using fallback mode');
        }
      }

      if (useEdgeFunctions) {
        // Use Supabase Edge Functions
        console.log('Using Supabase Edge Functions for scraping...');
        
        const convertResponse = await fetch(`${supabaseUrl}/functions/v1/convert-query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userQuery: query,
            urls: validUrls.map(entry => entry.url)
          }),
        });

        if (!convertResponse.ok) {
          const errorData = await convertResponse.json();
          throw new Error(`Failed to convert query: ${errorData.error || 'Unknown error'}`);
        }

        const { firecrawlConfig, extractionSchema } = await convertResponse.json();
        
        const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/execute-scrape`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            urls: validUrls.map(entry => entry.url),
            firecrawlConfig,
            extractionSchema,
            userQuery: query
          }),
        });

        if (!scrapeResponse.ok) {
          const errorData = await scrapeResponse.json();
          throw new Error(`Failed to execute scraping: ${errorData.error || 'Unknown error'}`);
        }

        const scrapeData = await scrapeResponse.json();
        
        // Process results for display
        const allExtractedData = [];
        const successfulResults = scrapeData.results.filter(r => r.success);
        
        successfulResults.forEach(result => {
          if (result.data?.extract && Array.isArray(result.data.extract)) {
            allExtractedData.push(...result.data.extract);
          } else if (result.data?.raw?.markdown || result.data?.raw?.html) {
            const content = result.data.raw.markdown || result.data.raw.html;
            const lines = content.split('\n').filter(line => line.trim() && line.length > 10);
            
            lines.slice(0, 20).forEach((line, index) => {
              allExtractedData.push({
                content: line.trim(),
                url: result.url,
                title: result.data.metadata?.title || `Item ${index + 1}`,
                source: 'raw_content',
                index: index + 1
              });
            });
          }
        });

        setResult({
          id: `scrape-${Date.now()}`,
          preview: allExtractedData.slice(0, 10),
          total_items: scrapeData.summary.total_items_extracted,
          status: 'completed',
          urls_processed: scrapeData.summary.successful_scrapes,
          failed_urls: scrapeData.summary.failed_scrapes,
          raw_data: allExtractedData,
          extraction_method: scrapeData.results[0]?.data?.metadata?.extractionMethod || 'edge_functions',
          used_chatgpt: scrapeData.results.some(r => r.data?.metadata?.usedChatGPT) || false,
          specific_data_type: scrapeData.results[0]?.data?.metadata?.specificDataType || null
        });

        // Save to database or local storage
        if (allExtractedData.length > 0) {
          await createScrape(
            validUrls.map(entry => entry.url),
            query,
            allExtractedData,
            allExtractedData.slice(0, 3)
          );
        }
      } else {
        // Fallback mode - simple web scraping without Edge Functions
        console.log('Using fallback mode for scraping...');
        
        const allExtractedData = [];
        
        for (const urlEntry of validUrls) {
          try {
            // Simple fetch to get basic content
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(urlEntry.url)}`);
            const data = await response.json();
            
            if (data.contents) {
              // Parse basic content
              const parser = new DOMParser();
              const doc = parser.parseFromString(data.contents, 'text/html');
              
              // Extract based on query type
              if (query.toLowerCase().includes('headline') || query.toLowerCase().includes('title')) {
                const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
                headings.forEach((heading, index) => {
                  if (heading.textContent?.trim()) {
                    allExtractedData.push({
                      title: heading.textContent.trim(),
                      type: 'heading',
                      level: heading.tagName.toLowerCase(),
                      url: urlEntry.url,
                      index: index + 1,
                      source: 'fallback_scraping'
                    });
                  }
                });
              } else if (query.toLowerCase().includes('link')) {
                const links = doc.querySelectorAll('a[href]');
                links.forEach((link, index) => {
                  if (link.textContent?.trim() && link.getAttribute('href')) {
                    allExtractedData.push({
                      title: link.textContent.trim(),
                      url: link.getAttribute('href'),
                      type: 'link',
                      source_url: urlEntry.url,
                      index: index + 1,
                      source: 'fallback_scraping'
                    });
                  }
                });
              } else {
                // General content extraction
                const paragraphs = doc.querySelectorAll('p, div, span');
                let contentIndex = 0;
                paragraphs.forEach((element) => {
                  const text = element.textContent?.trim();
                  if (text && text.length > 20 && contentIndex < 20) {
                    allExtractedData.push({
                      content: text,
                      type: 'text',
                      url: urlEntry.url,
                      index: contentIndex + 1,
                      source: 'fallback_scraping'
                    });
                    contentIndex++;
                  }
                });
              }
            }
          } catch (error) {
            console.error(`Error scraping ${urlEntry.url}:`, error);
            // Add error entry
            allExtractedData.push({
              error: `Failed to scrape ${urlEntry.url}: ${error.message}`,
              url: urlEntry.url,
              type: 'error',
              source: 'fallback_scraping'
            });
          }
        }

        setResult({
          id: `scrape-${Date.now()}`,
          preview: allExtractedData.slice(0, 10),
          total_items: allExtractedData.length,
          status: 'completed',
          urls_processed: validUrls.length,
          failed_urls: 0,
          raw_data: allExtractedData,
          extraction_method: 'fallback_mode',
          used_chatgpt: false,
          specific_data_type: null
        });
      }

    } catch (error) {
      console.error('Scraping error:', error);
      setError(`${error.message || 'An error occurred during scraping'}. Check the browser console for detailed logs.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadJSON = () => {
    const dataToDownload = result?.raw_data || mockData;
    const jsonBlob = new Blob([JSON.stringify(dataToDownload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scrape_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    try {
      const dataToExport = result?.raw_data || mockData;
      downloadCSV(dataToExport, 'scrape_results.csv');
    } catch (error) {
      console.error('CSV generation error:', error);
      setError('Failed to generate CSV. Please try again.');
    }
  };

  const handleDownloadMarkdown = () => {
    try {
      const dataToExport = result?.raw_data || mockData;
      downloadMarkdown(dataToExport, 'scrape_results.md');
    } catch (error) {
      console.error('Markdown download error:', error);
      setError('Failed to download markdown. Please try again.');
    }
  };

  const handleHistorySelect = (record: ScrapeRecord | LocalScrapeRecord) => {
    setResult({
      id: record.id,
      preview: record.preview_data || [],
      total_items: record.total_items || record.results?.length || 0,
      status: 'completed',
      raw_data: record.results,
      extraction_method: user && supabase ? 'database' : 'local_storage',
      used_chatgpt: false,
      specific_data_type: null
    });
    setUrls(record.target_urls.map((url: string, index: number) => ({ 
      id: (index + 1).toString(), 
      url 
    })));
    setQuery(record.user_query);
    setIsHistoryOpen(false);
  };

  const handleHistoryRemove = (id: string) => {
    deleteScrape(id);
  };

  const handleReset = () => {
    setUrls([{ id: '1', url: '' }]);
    setQuery('');
    setResult(null);
    setError(null);
  };

  const validUrlCount = urls.filter(entry => entry.url.trim() !== '').length;
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="text-center flex-1">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Data<span className="text-blue-300">Glass</span>
            </h1>
            <p className="text-white/70 text-lg">
              Intelligent web scraping powered by AI
            </p>
          </div>
        </motion.div>

        {/* Main Interface */}
        <div className="space-y-6">
          {/* Input Section */}
          <GlassCard className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Target URLs ({validUrlCount} {validUrlCount === 1 ? 'URL' : 'URLs'})
                </label>
                <p className="text-white/60 text-xs mb-3">
                  💡 Tip: You can paste multiple URLs separated by commas to automatically expand them
                </p>
                <div className="space-y-3">
                  {urls.map((urlEntry, index) => (
                    <motion.div
                      key={urlEntry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center space-x-3"
                    >
                      <div className="relative flex-1">
                        <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5" />
                        <input
                          type="url"
                          value={urlEntry.url}
                          onChange={(e) => handleUrlChange(urlEntry.id, e.target.value)}
                          placeholder={index === 0 ? "https://example.com, https://site2.com, ..." : `https://example${index + 1}.com`}
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
                        />
                      </div>
                      
                      {urls.length > 1 && (
                        <button
                          onClick={() => removeUrl(urlEntry.id)}
                          className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                          title="Remove URL"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                  
                  <button
                    onClick={addUrl}
                    className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors text-sm border border-white/20 border-dashed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add another URL</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  What do you want to extract?
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., 'all headlines', 'product prices', 'contact information'"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleScrape}
                  disabled={validUrlCount === 0 || !query || isLoading}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  <span>Extract Data{validUrlCount > 1 ? ` from ${validUrlCount} URLs` : ''}</span>
                </button>

                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center space-x-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title={user && supabase ? "View your scrape history" : "View local scrape history"}
                >
                  <History className="w-5 h-5" />
                  <span>History</span>
                  {!user && (
                    <span className="text-xs opacity-60">(Local)</span>
                  )}
                </button>

                {result && (
                  <button
                    onClick={handleReset}
                    className="flex items-center space-x-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>New Scrape</span>
                  </button>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Loading State */}
          {isLoading && (
            <GlassCard className="p-8">
              <LoadingSpinner />
            </GlassCard>
          )}

          {/* Error State */}
          {error && (
            <GlassCard className="p-6 border-red-500/20 bg-red-500/10">
              <div className="text-red-300 text-center">
                <p className="font-medium mb-2">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </GlassCard>
          )}

          {/* Results */}
          {result && !isLoading && (
            <GlassCard className="p-6">
              <div className="space-y-6">
                {/* Results Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Extraction Results
                    </h3>
                    <div className="space-y-1">
                      <p className="text-white/60 text-sm">
                        Found {result.total_items} items from {result.urls_processed || 1} {result.urls_processed === 1 ? 'URL' : 'URLs'}
                      </p>
                      {result.extraction_method && (
                        <p className="text-white/50 text-xs">
                          Extraction method: {result.extraction_method}
                          {result.used_chatgpt && (
                            <span className="ml-2 px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                              AI Enhanced
                            </span>
                          )}
                          {result.specific_data_type && (
                            <span className="ml-2 px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                              Specific: {result.specific_data_type}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadJSON}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>JSON</span>
                    </button>
                    <button
                      onClick={handleDownloadCSV}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={handleDownloadMarkdown}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Markdown</span>
                    </button>
                  </div>
                </div>

                {/* View Mode Tabs */}
                <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                      viewMode === 'table'
                        ? 'bg-blue-500 text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                      viewMode === 'json'
                        ? 'bg-blue-500 text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    JSON Source
                  </button>
                </div>

                {/* Data Display */}
                <div className="bg-white/5 rounded-lg p-4">
                  {viewMode === 'table' ? (
                    <DataTable data={result?.raw_data || mockData} />
                  ) : (
                    <JsonViewer data={result?.raw_data || mockData} />
                  )}
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* History Panel */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={scrapes}
        onSelectHistory={handleHistorySelect}
        onRemoveHistory={handleHistoryRemove}
      />
    </div>
  );
}

export default App;