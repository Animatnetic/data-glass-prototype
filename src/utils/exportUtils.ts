interface TableData {
  [key: string]: any;
}

export const convertTableToCSV = (data: TableData[]): string => {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  // Get all unique keys from the data
  const allKeys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
  
  // Create CSV header
  const header = allKeys.map(key => `"${key}"`).join(',');
  
  // Create CSV rows
  const rows = data.map(item => {
    return allKeys.map(key => {
      const value = item[key];
      
      if (value === null || value === undefined) {
        return '""';
      }
      
      // Handle different data types
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      
      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
};

export const downloadCSV = (data: TableData[], filename: string = 'scrape_results.csv'): void => {
  const csv = convertTableToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const convertTableToMarkdown = (data: TableData[]): string => {
  if (!data || data.length === 0) {
    return '# No Data Available\n\nNo data was found to export.';
  }

  // Get all unique keys from the data
  const allKeys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
  
  let markdown = '# Web Scraping Results\n\n';
  markdown += `*Generated on ${new Date().toLocaleString()}*\n\n`;
  markdown += `**Total Records:** ${data.length}\n\n`;
  
  // Create table header
  markdown += '| ' + allKeys.join(' | ') + ' |\n';
  markdown += '| ' + allKeys.map(() => '---').join(' | ') + ' |\n';
  
  // Add table rows
  data.forEach(item => {
    const row = allKeys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) {
        return '';
      }
      
      // Handle different data types
      if (typeof value === 'object') {
        return JSON.stringify(value).replace(/\|/g, '\\|');
      }
      
      // Escape pipe characters and limit length
      let stringValue = String(value).replace(/\|/g, '\\|');
      if (stringValue.length > 100) {
        stringValue = stringValue.substring(0, 97) + '...';
      }
      
      return stringValue;
    });
    
    markdown += '| ' + row.join(' | ') + ' |\n';
  });
  
  // Add summary section
  markdown += '\n## Data Summary\n\n';
  markdown += `- **Total Records:** ${data.length}\n`;
  markdown += `- **Columns:** ${allKeys.length}\n`;
  markdown += `- **Column Names:** ${allKeys.join(', ')}\n`;
  
  // Add data types analysis
  markdown += '\n## Column Analysis\n\n';
  allKeys.forEach(key => {
    const sampleValues = data.slice(0, 5).map(item => item[key]).filter(v => v !== null && v !== undefined);
    const types = [...new Set(sampleValues.map(v => typeof v))];
    markdown += `- **${key}:** ${types.join(', ')} (${sampleValues.length} sample values)\n`;
  });
  
  return markdown;
};

export const downloadMarkdown = (data: TableData[], filename: string = 'scrape_results.md'): void => {
  const markdown = convertTableToMarkdown(data);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};