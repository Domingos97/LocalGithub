import { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, ExternalLink, Clock, Cpu } from 'lucide-react';
import '../styles/ProcessMonitor.css';

interface Process {
  id: string;
  name: string;
  port?: number;
  status: 'running' | 'stopped' | 'error';
  startTime?: Date;
  memory?: string;
}

interface ProcessMonitorProps {
  processes: Process[];
  onStop?: (id: string) => void;
  onRestart?: (id: string) => void;
  onOpen?: (port: number) => void;
}

function ProcessMonitor({ processes, onStop, onRestart, onOpen }: ProcessMonitorProps) {
  const [uptime, setUptime] = useState<Record<string, string>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const newUptime: Record<string, string> = {};
      processes.forEach((p) => {
        if (p.startTime && p.status === 'running') {
          const diff = Date.now() - new Date(p.startTime).getTime();
          const seconds = Math.floor(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);

          if (hours > 0) {
            newUptime[p.id] = `${hours}h ${minutes % 60}m`;
          } else if (minutes > 0) {
            newUptime[p.id] = `${minutes}m ${seconds % 60}s`;
          } else {
            newUptime[p.id] = `${seconds}s`;
          }
        }
      });
      setUptime(newUptime);
    }, 1000);

    return () => clearInterval(interval);
  }, [processes]);

  if (processes.length === 0) {
    return (
      <div className="process-monitor-empty">
        <Cpu size={48} className="empty-icon" />
        <p>No running processes</p>
        <span>Start a project to see it here</span>
      </div>
    );
  }

  return (
    <div className="process-monitor">
      {processes.map((process) => (
        <div key={process.id} className={`process-item process-${process.status}`}>
          <div className="process-info">
            <div className="process-status">
              <span className={`status-dot status-${process.status}`} />
              <span className="process-name">{process.name}</span>
            </div>
            <div className="process-details">
              {process.port && (
                <span className="process-port">
                  <span className="port-label">Port:</span> {process.port}
                </span>
              )}
              {uptime[process.id] && (
                <span className="process-uptime">
                  <Clock size={12} />
                  {uptime[process.id]}
                </span>
              )}
              {process.memory && (
                <span className="process-memory">
                  <Cpu size={12} />
                  {process.memory}
                </span>
              )}
            </div>
          </div>
          <div className="process-actions">
            {process.port && onOpen && (
              <button
                className="process-btn process-btn-open"
                onClick={() => onOpen(process.port!)}
                title="Open in browser"
              >
                <ExternalLink size={14} />
              </button>
            )}
            {onRestart && process.status === 'running' && (
              <button
                className="process-btn process-btn-restart"
                onClick={() => onRestart(process.id)}
                title="Restart"
              >
                <RefreshCw size={14} />
              </button>
            )}
            {onStop && process.status === 'running' && (
              <button
                className="process-btn process-btn-stop"
                onClick={() => onStop(process.id)}
                title="Stop"
              >
                <Square size={14} />
              </button>
            )}
            {process.status === 'stopped' && (
              <button className="process-btn process-btn-start" title="Start">
                <Play size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProcessMonitor;
