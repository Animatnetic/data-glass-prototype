import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface JsonViewerProps {
  data: any;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="rounded-lg overflow-hidden">
      <SyntaxHighlighter
        language="json"
        style={atomDark}
        customStyle={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: '1.4',
        }}
        wrapLines
        wrapLongLines
      >
        {jsonString}
      </SyntaxHighlighter>
    </div>
  );
};