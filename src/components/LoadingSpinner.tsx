import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Processing...' 
}) => {
  const defaultMessages = [
    'Dispatching to the edge...',
    'Parsing content...',
    'Extracting data...',
    'Finalizing results...'
  ];

  const multiUrlMessages = [
    'Processing multiple URLs concurrently...',
    'Analyzing content from all sources...',
    'Extracting data in parallel...',
    'Consolidating results...'
  ];

  // Use different messages based on the provided message
  const messages = message.includes('multiple') || message.includes('concurrent') 
    ? multiUrlMessages 
    : defaultMessages;

  const [currentMessage, setCurrentMessage] = React.useState(
    message === 'Processing...' ? messages[0] : message
  );

  React.useEffect(() => {
    if (message !== 'Processing...') {
      setCurrentMessage(message);
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentMessage(prev => {
        const currentIndex = messages.indexOf(prev);
        return messages[(currentIndex + 1) % messages.length];
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [message, messages]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full"
      />
      <motion.p
        key={currentMessage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-gray-700 text-sm"
      >
        {currentMessage}
      </motion.p>
    </div>
  );
};