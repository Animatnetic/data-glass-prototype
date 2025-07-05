import jsPDF from 'jspdf';

interface TableData {
  [key: string]: any;
}

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

export const generatePDFFromMarkdown = async (markdown: string, filename: string = 'scrape_results.pdf'): Promise<void> => {
  try {
    // Create a temporary div to render the markdown as HTML
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '800px';
    tempDiv.style.padding = '20px';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.fontSize = '12px';
    tempDiv.style.lineHeight = '1.4';
    tempDiv.style.color = '#000';
    tempDiv.style.backgroundColor = '#fff';
    
    // Convert markdown to HTML (basic conversion)
    const htmlContent = markdownToHTML(markdown);
    tempDiv.innerHTML = htmlContent;
    
    document.body.appendChild(tempDiv);
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Split content into pages
    const lines = markdown.split('\n');
    let currentY = margin;
    let pageNumber = 1;
    
    // Add title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Web Scraping Results', margin, currentY);
    currentY += 10;
    
    // Add generation date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated on ${new Date().toLocaleString()}`, margin, currentY);
    currentY += 15;
    
    // Process each line
    for (const line of lines) {
      if (currentY > pageHeight - margin) {
        // Add new page
        pdf.addPage();
        currentY = margin;
        pageNumber++;
      }
      
      // Handle different markdown elements
      if (line.startsWith('# ')) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        const text = line.replace('# ', '');
        pdf.text(text, margin, currentY);
        currentY += 8;
      } else if (line.startsWith('## ')) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const text = line.replace('## ', '');
        pdf.text(text, margin, currentY);
        currentY += 7;
      } else if (line.startsWith('| ') && line.includes(' | ')) {
        // Table row
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        const cells = line.split(' | ').map(cell => cell.replace(/^\| |\| ?$/g, ''));
        
        // Simple table layout
        const cellWidth = contentWidth / cells.length;
        cells.forEach((cell, index) => {
          const x = margin + (index * cellWidth);
          const truncatedCell = cell.length > 25 ? cell.substring(0, 22) + '...' : cell;
          pdf.text(truncatedCell, x, currentY);
        });
        currentY += 5;
      } else if (line.startsWith('- ')) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const text = line.replace('- ', '• ');
        const splitText = pdf.splitTextToSize(text, contentWidth);
        pdf.text(splitText, margin, currentY);
        currentY += splitText.length * 5;
      } else if (line.trim() !== '' && !line.startsWith('|')) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const splitText = pdf.splitTextToSize(line, contentWidth);
        pdf.text(splitText, margin, currentY);
        currentY += splitText.length * 5;
      } else if (line.trim() === '') {
        currentY += 3;
      }
    }
    
    // Add page numbers
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
    }
    
    // Clean up
    document.body.removeChild(tempDiv);
    
    // Download the PDF
    pdf.save(filename);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};

// Basic markdown to HTML converter
const markdownToHTML = (markdown: string): string => {
  return markdown
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^\*\*(.*)\*\*$/gm, '<strong>$1</strong>')
    .replace(/^\*(.*)\*$/gm, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
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