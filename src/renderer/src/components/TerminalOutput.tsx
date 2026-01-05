import { useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, Download } from 'lucide-react';
import '../styles/TerminalOutput.css';

interface TerminalOutputProps {
  lines: string[];
  title?: string;
  maxLines?: number;
  onClear?: () => void;
  className?: string;
}

function TerminalOutput({
  lines,
  title = 'Terminal Output',
  maxLines = 1000,
  onClear,
  className = '',
}: TerminalOutputProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const displayLines = lines.slice(-maxLines);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayLines.join('\n'));
  };

  const handleDownload = () => {
    const blob = new Blob([displayLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terminal-output.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatLine = (line: string) => {
    // Color coding for common terminal patterns
    if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
      return <span className="terminal-error">{line}</span>;
    }
    if (line.includes('warning') || line.includes('Warning') || line.includes('WARN')) {
      return <span className="terminal-warning">{line}</span>;
    }
    if (line.includes('success') || line.includes('Success') || line.includes('✓') || line.includes('done')) {
      return <span className="terminal-success">{line}</span>;
    }
    if (line.startsWith('$') || line.startsWith('>')) {
      return <span className="terminal-command">{line}</span>;
    }
    return line;
  };

  return (
    <div className={`terminal-container ${className}`}>
      <div className="terminal-header">
        <div className="terminal-title">
          <Terminal size={16} />
          <span>{title}</span>
        </div>
        <div className="terminal-actions">
          <button className="terminal-btn" onClick={handleCopy} title="Copy to clipboard">
            <Copy size={14} />
          </button>
          <button className="terminal-btn" onClick={handleDownload} title="Download log">
            <Download size={14} />
          </button>
          {onClear && (
            <button className="terminal-btn" onClick={onClear} title="Clear terminal">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="terminal-body" ref={terminalRef}>
        {displayLines.length === 0 ? (
          <div className="terminal-empty">No output yet...</div>
        ) : (
          displayLines.map((line, index) => (
            <div key={index} className="terminal-line">
              <span className="terminal-line-number">{index + 1}</span>
              <span className="terminal-line-content">{formatLine(line)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TerminalOutput;
