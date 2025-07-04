import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Download, 
  FileText, 
  History,
  RefreshCw,
  ExternalLink,
  Database,
  Clock,
  X,
  Plus,
  Trash2
} from 'lucide-react';

// Mock data for demonstration
const mockData = [
  { title: "Breaking: Tech Giants Report Record Earnings", url: "https://example.com/news1", category: "Technology", date: "2024-01-15" },
  { title: "Climate Summit Reaches Historic Agreement", url: "https://example.com/news2", category: "Environment", date: "2024-01-14" },
  { title: "New AI Breakthrough in Medical Research", url: "https://example.com/news3", category: "Science", date: "2024-01-13" },
  { title: "Global Markets Show Strong Recovery", url: "https://example.com/news4", category: "Finance", date: "2024-01-12" },
  { title: "Space Mission Discovers New Exoplanet", url: "https://example.com/news5", category: "Space", date: "2024-01-11" }
];

const mockHistory = [
  { id: '1', url: 'bbc.com', query: 'headlines', date: '2 hours ago', status: 'completed' },
  { id: '2', url: 'techcrunch.com', query: 'startup funding news', date: '1 day ago', status: 'completed' },
  { id: '3', url: 'reuters.com', query: 'market data', date: '2 days ago', status: 'completed' },
];

type ViewMode = 'table' | 'json';

interface UrlEntry {
  id: string;
  url: string;
}
// Glass Card Component
const GlassCard: React.FC<{ children: React.ReactNode; className?: string; animate?: boolean }> = ({ 
  children, 
  className = '', 
  animate = true 
}) => {
  const cardClasses = `
    backdrop-blur-xl bg-white/10 
    border border-white/20 
    rounded-2xl shadow-2xl 
    ${className}
  `;

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cardClasses}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={cardClasses}>{children}</div>;
};

// Loading Spinner Component
const LoadingSpinner: React.FC = () => {
  const messages = [
    'Dispatching to the edge...',
    'Parsing content...',
    'Extracting data...',
    'Finalizing results...'
  ];

  const [currentMessage, setCurrentMessage] = React.useState(messages[0]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage(prev => {
        const currentIndex = messages.indexOf(prev);
        return messages[(currentIndex + 1) % messages.length];
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
      />
      <motion.p
        key={currentMessage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-white/80 text-sm"
      >
        {currentMessage}
      </motion.p>
    </div>
  );
};

// Data Table Component
const DataTable: React.FC<{ data: any[] }> = ({ data }) => {
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [sortField, setSortField] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const filteredData = data.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(globalFilter.toLowerCase())
    )
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-white/60">
        No data available
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="space-y-4">
      {/* Global Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search all columns..."
          className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-white/80 font-medium border-b border-white/10 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.charAt(0).toUpperCase() + column.slice(1)}</span>
                    {sortField === column && (
                      <span className="text-blue-300">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr 
                key={index} 
                className="hover:bg-white/5 transition-colors duration-150"
              >
                {columns.map(column => (
                  <td key={column} className="px-4 py-3 text-white/70 border-b border-white/5">
                    {typeof row[column] === 'string' && row[column].startsWith('http') ? (
                      <a 
                        href={row[column]} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:text-blue-200 underline"
                      >
                        {row[column].length > 50 ? row[column].substring(0, 50) + '...' : row[column]}
                      </a>
                    ) : (
                      String(row[column])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Info */}
      <div className="text-sm text-white/50 text-center">
        Showing {sortedData.length} of {data.length} results
      </div>
    </div>
  );
};

// JSON Viewer Component
const JsonViewer: React.FC<{ data: any }> = ({ data }) => {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="bg-black/20 rounded-lg p-4 overflow-auto max-h-96">
      <pre className="text-green-300 text-sm font-mono whitespace-pre-wrap">
        {jsonString}
      </pre>
    </div>
  );
};

// History Panel Component
const HistoryPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  history: any[];
  onSelectHistory: (record: any) => void;
}> = ({ isOpen, onClose, history, onSelectHistory }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-96 bg-white/10 backdrop-blur-xl border-l border-white/20 z-50"
      >
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-white/70" />
              <h2 className="text-xl font-semibold text-white">Scrape History</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-8 text-white/50">
                No scrapes yet
              </div>
            ) : (
              history.map((record) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => onSelectHistory(record)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                        <p className="text-white/80 text-sm font-medium truncate">
                          {record.url}
                        </p>
                      </div>
                      <p className="text-white/60 text-sm mb-2 line-clamp-2">
                        "{record.query}"
                      </p>
                      <div className="flex items-center justify-between text-xs text-white/40">
                        <span>{record.date}</span>
                        <span className={`px-2 py-1 rounded-full ${
                          record.status === 'completed' 
                            ? 'bg-green-500/20 text-green-300' 
                            : record.status === 'error'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {record.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

function App() {
  const [urls, setUrls] = useState<UrlEntry[]>([{ id: '1', url: '' }]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

    // Simulate API call
    setTimeout(() => {
      setResult({
        id: 'demo-123',
        preview: mockData.slice(0, 3),
        total_items: mockData.length * validUrls.length, // Simulate data from multiple URLs
        selectors_used: ['h1', 'h2', '.title', 'a[href]'],
        status: 'completed',
        urls_processed: validUrls.length
      });
      setIsLoading(false);
    }, 3000);
  };

  const handleDownloadJSON = () => {
    const jsonBlob = new Blob([JSON.stringify(mockData, null, 2)], {
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

  const handleDownloadPDF = () => {
    // Simulate PDF download
    alert('PDF generation would be handled by the backend Edge Function');
  };

  const handleHistorySelect = (record: any) => {
    setResult({
      id: record.id,
      preview: mockData.slice(0, 3),
      total_items: mockData.length,
      selectors_used: ['h1', 'h2', '.title'],
      status: 'completed'
    });
    setUrls([{ id: '1', url: `https://${record.url}` }]);
    setQuery(record.query);
    setIsHistoryOpen(false);
  };

  const handleReset = () => {
    setUrls([{ id: '1', url: '' }]);
    setQuery('');
    setResult(null);
    setError(null);
  };

  const validUrlCount = urls.filter(entry => entry.url.trim() !== '').length;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Data<span className="text-blue-300">Glass</span>
          </h1>
          <p className="text-white/70 text-lg">
            Intelligent web scraping powered by serverless edge computing
          </p>
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
                <p className="text-white/50 text-xs mb-3">
                  💡 Tip: You can paste multiple URLs separated by commas in any field to automatically expand them
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
                    <Database className="w-5 h-5" />
                  )}
                  <span>Extract Data{validUrlCount > 1 ? ` from ${validUrlCount} URLs` : ''}</span>
                </button>

                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center space-x-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  <History className="w-5 h-5" />
                  <span>History</span>
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
                    <p className="text-white/60 text-sm">
                      Found {result.total_items} items from {result.urls_processed || 1} {result.urls_processed === 1 ? 'URL' : 'URLs'} using {result.selectors_used.length} selectors
                    </p>
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
                      onClick={handleDownloadPDF}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      <span>PDF</span>
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
                    <DataTable data={mockData} />
                  ) : (
                    <JsonViewer data={mockData} />
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
        history={mockHistory}
        onSelectHistory={handleHistorySelect}
      />
    </div>
  );
}

export default App;