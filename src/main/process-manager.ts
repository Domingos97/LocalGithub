import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import net from 'net';

export interface RunningProcess {
  id: string;
  projectName: string;
  command: string;
  port: number;
  pid: number | null;
  status: 'running' | 'stopped' | 'error';
  output: string[];
  startTime: Date;
  type: 'frontend' | 'backend' | 'other';
}

class ProcessManager extends EventEmitter {
  private processes: Map<string, RunningProcess & { child: ChildProcess | null }> = new Map();
  private nextProcessId = 1;

  async startProcess(
    projectName: string,
    command: string,
    cwd: string,
    port: number,
    type: 'frontend' | 'backend' | 'other' = 'other'
  ): Promise<RunningProcess> {
    const processId = `process-${this.nextProcessId++}`;
    const allocatedPort = await this.findAvailablePort(port);

    const finalCommand = command.replace(/\$PORT/g, allocatedPort.toString());
    const [executable, ...args] = finalCommand.split(' ');

    console.log(`Starting process: ${projectName} with command: ${finalCommand}`);

    try {
      const child = spawn(executable, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      const processData: RunningProcess & { child: ChildProcess | null } = {
        id: processId,
        projectName,
        command: finalCommand,
        port: allocatedPort,
        pid: child.pid || null,
        status: 'running',
        output: [],
        startTime: new Date(),
        type,
        child,
      };

      // Handle stdout
      child.stdout?.on('data', (data) => {
        const output = data.toString();
        processData.output.push(`[STDOUT] ${output}`);
        this.emit('output', { processId, output: `[STDOUT] ${output}` });
      });

      // Handle stderr
      child.stderr?.on('data', (data) => {
        const output = data.toString();
        processData.output.push(`[STDERR] ${output}`);
        this.emit('output', { processId, output: `[STDERR] ${output}` });
      });

      // Handle process exit
      child.on('exit', (code: number | null) => {
        processData.status = code === 0 ? 'stopped' : 'error';
        this.emit('processExit', { id: processId, code });
        this.processes.delete(processId);
      });

      // Handle process error
      child.on('error', (error) => {
        processData.status = 'error';
        this.emit('processError', { processId, error: error.message });
      });

      this.processes.set(processId, processData);
      this.emit('processStarted', processData);

      return {
        id: processData.id,
        projectName: processData.projectName,
        command: processData.command,
        port: processData.port,
        pid: processData.pid,
        status: processData.status,
        output: processData.output,
        startTime: processData.startTime,
        type: processData.type,
      };
    } catch (error) {
      console.error(`Error starting process: ${error}`);
      throw error;
    }
  }

  stopProcess(processId: string): boolean {
    const processData = this.processes.get(processId);
    if (!processData || !processData.child) return false;

    processData.child.kill();
    processData.status = 'stopped';
    return true;
  }

  stopAllProcesses(): void {
    for (const [_processId, processData] of this.processes) {
      if (processData.child) {
        processData.child.kill();
        processData.status = 'stopped';
      }
    }
    this.processes.clear();
  }

  getProcess(processId: string): RunningProcess | null {
    const data = this.processes.get(processId);
    if (!data) return null;

    return {
      id: data.id,
      projectName: data.projectName,
      command: data.command,
      port: data.port,
      pid: data.pid,
      status: data.status,
      output: data.output,
      startTime: data.startTime,
      type: data.type,
    };
  }

  getAllProcesses(): RunningProcess[] {
    return Array.from(this.processes.values()).map((p) => ({
      id: p.id,
      projectName: p.projectName,
      command: p.command,
      port: p.port,
      pid: p.pid,
      status: p.status,
      output: p.output,
      startTime: p.startTime,
      type: p.type,
    }));
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const port = await this.checkPort(startPort);
    if (port === startPort) {
      return port;
    }

    // If port is in use, try next 100 ports
    for (let i = 1; i <= 100; i++) {
      const candidate = startPort + i;
      const result = await this.checkPort(candidate);
      if (result === candidate) {
        return candidate;
      }
    }

    return startPort;
  }

  private checkPort(port: number): Promise<number> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(-1); // Port in use
        } else {
          resolve(port);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(port); // Port available
      });

      server.listen(port, '127.0.0.1');
    });
  }
}

export const processManager = new ProcessManager();
