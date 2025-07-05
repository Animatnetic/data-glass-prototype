import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ExternalLink, X, Trash2 } from 'lucide-react';
import { LocalScrapeRecord } from '../hooks/useLocalHistory';


interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: LocalScrapeRecord[];
  onSelectHistory: (record: LocalScrapeRecord) => void;
  onRemoveHistory: (id: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistory,
  onRemoveHistory
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
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
                      className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => onSelectHistory(record)}
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                            <p className="text-white/80 text-sm font-medium truncate">
                              {record.target_urls.length > 1 
                                ? `${record.target_urls.length} URLs` 
                                : record.target_urls[0] ? new URL(record.target_urls[0]).hostname : 'Unknown URL'}
                            </p>
                          </div>
                          <p className="text-white/60 text-sm mb-2 line-clamp-2">
                            "{record.user_query}"
                          </p>
                          <div className="flex items-center justify-between text-xs text-white/40">
                            <span>
                              {new Date(record.created_at).toLocaleString()}
                            </span>
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
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveHistory(record.id);
                          }}
                          className="p-2 hover:bg-red-500/20 text-red-300 hover:text-red-200 rounded-lg transition-colors flex-shrink-0"
                          title="Remove from history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};