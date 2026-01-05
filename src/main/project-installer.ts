import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { gitOps } from './git-operations';

export interface InstallConfig {
  packageManager: string;
  installCommand: string;
  buildCommand?: string;
  devCommand?: string;
  startCommand?: string;
}

export interface InstallProgress {
  stage: 'cloning' | 'detecting' | 'installing' | 'complete' | 'error';
  progress: number;
  message: string;
}

type ProgressCallback = (progress: InstallProgress) => void;

class ProjectInstaller {
  /**
   * Detect project type by analyzing files in the project directory
   */
  async detectProjectConfig(projectPath: string): Promise<InstallConfig> {
    const files = await this.listProjectFiles(projectPath);
    
    // Node.js project detection
    if (files.includes('package.json')) {
      return await this.detectNodeConfig(projectPath);
    }
    
    // Python project detection
    if (files.includes('requirements.txt')) {
      return {
        packageManager: 'pip',
        installCommand: 'pip install -r requirements.txt',
        startCommand: 'python main.py',
      };
    }
    
    if (files.includes('pyproject.toml')) {
      const content = await fs.readFile(path.join(projectPath, 'pyproject.toml'), 'utf-8');
      if (content.includes('[tool.poetry]')) {
        return {
          packageManager: 'poetry',
          installCommand: 'poetry install',
          startCommand: 'poetry run python main.py',
        };
      }
      return {
        packageManager: 'pip',
        installCommand: 'pip install -e .',
        startCommand: 'python -m ' + path.basename(projectPath),
      };
    }
    
    if (files.includes('setup.py')) {
      return {
        packageManager: 'pip',
        installCommand: 'pip install -e .',
        startCommand: 'python -m ' + path.basename(projectPath),
      };
    }
    
    // Rust project detection
    if (files.includes('Cargo.toml')) {
      return {
        packageManager: 'cargo',
        installCommand: 'cargo build',
        buildCommand: 'cargo build --release',
        startCommand: 'cargo run',
      };
    }
    
    // Go project detection
    if (files.includes('go.mod')) {
      return {
        packageManager: 'go',
        installCommand: 'go mod download',
        buildCommand: 'go build',
        startCommand: 'go run .',
      };
    }
    
    // .NET project detection
    if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
      return {
        packageManager: 'dotnet',
        installCommand: 'dotnet restore',
        buildCommand: 'dotnet build',
        startCommand: 'dotnet run',
      };
    }
    
    // Java/Maven detection
    if (files.includes('pom.xml')) {
      return {
        packageManager: 'maven',
        installCommand: 'mvn install -DskipTests',
        buildCommand: 'mvn package',
        startCommand: 'mvn exec:java',
      };
    }
    
    // Java/Gradle detection
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      const isWindows = process.platform === 'win32';
      const gradle = isWindows ? 'gradlew.bat' : './gradlew';
      return {
        packageManager: 'gradle',
        installCommand: `${gradle} build -x test`,
        buildCommand: `${gradle} build`,
        startCommand: `${gradle} run`,
      };
    }
    
    // Ruby/Bundler detection
    if (files.includes('Gemfile')) {
      return {
        packageManager: 'bundler',
        installCommand: 'bundle install',
        startCommand: 'bundle exec ruby main.rb',
      };
    }
    
    // PHP/Composer detection
    if (files.includes('composer.json')) {
      return {
        packageManager: 'composer',
        installCommand: 'composer install',
        startCommand: 'php artisan serve',  // Assuming Laravel, fallback for others
      };
    }
    
    // Default fallback
    return {
      packageManager: 'unknown',
      installCommand: '',
    };
  }

  /**
   * Detect Node.js specific configuration
   */
  private async detectNodeConfig(projectPath: string): Promise<InstallConfig> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    // Detect package manager from lockfiles or packageManager field
    let packageManager = 'npm';
    const files = await this.listProjectFiles(projectPath);
    
    if (packageJson.packageManager?.startsWith('pnpm')) {
      packageManager = 'pnpm';
    } else if (packageJson.packageManager?.startsWith('yarn')) {
      packageManager = 'yarn';
    } else if (files.includes('pnpm-lock.yaml')) {
      packageManager = 'pnpm';
    } else if (files.includes('yarn.lock')) {
      packageManager = 'yarn';
    } else if (files.includes('bun.lockb')) {
      packageManager = 'bun';
    }
    
    const scripts = packageJson.scripts || {};
    
    return {
      packageManager,
      installCommand: `${packageManager} install`,
      buildCommand: scripts.build ? `${packageManager} run build` : undefined,
      devCommand: scripts.dev ? `${packageManager} run dev` : undefined,
      startCommand: scripts.start ? `${packageManager} run start` : 
                   scripts.dev ? `${packageManager} run dev` : undefined,
    };
  }

  /**
   * List files in project root directory
   */
  private async listProjectFiles(projectPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      return entries.map(e => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Full installation process: clone + detect + install
   */
  async installProject(
    repoUrl: string,
    repoName: string,
    onProgress: ProgressCallback
  ): Promise<{ success: boolean; projectPath?: string; config?: InstallConfig; error?: string }> {
    try {
      // Stage 1: Clone repository
      onProgress({
        stage: 'cloning',
        progress: 10,
        message: `Cloning ${repoName}...`,
      });

      const projectPath = await gitOps.cloneRepository(repoUrl, repoName, {
        onProgress: (message) => {
          onProgress({
            stage: 'cloning',
            progress: 20,
            message,
          });
        },
      });

      onProgress({
        stage: 'cloning',
        progress: 40,
        message: 'Repository cloned successfully',
      });

      // Stage 2: Detect project type
      onProgress({
        stage: 'detecting',
        progress: 45,
        message: 'Detecting project type...',
      });

      const config = await this.detectProjectConfig(projectPath);

      onProgress({
        stage: 'detecting',
        progress: 50,
        message: `Detected ${config.packageManager} project`,
      });

      if (!config.installCommand) {
        onProgress({
          stage: 'complete',
          progress: 100,
          message: 'Project cloned (no install command detected)',
        });
        return { success: true, projectPath, config };
      }

      // Stage 3: Install dependencies
      onProgress({
        stage: 'installing',
        progress: 55,
        message: `Running: ${config.installCommand}`,
      });

      await this.runCommand(config.installCommand, projectPath, (output) => {
        onProgress({
          stage: 'installing',
          progress: 70,
          message: output,
        });
      });

      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Installation complete!',
      });

      return { success: true, projectPath, config };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress({
        stage: 'error',
        progress: 0,
        message: `Error: ${errorMessage}`,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Run a command in the project directory
   */
  private runCommand(command: string, cwd: string, onOutput: (output: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/sh';
      const shellFlag = isWindows ? '/c' : '-c';

      const proc = spawn(shell, [shellFlag, command], {
        cwd,
        env: { ...process.env },
      });

      proc.stdout.on('data', (data) => {
        onOutput(data.toString().trim());
      });

      proc.stderr.on('data', (data) => {
        onOutput(data.toString().trim());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if a project is already installed locally
   */
  async isProjectInstalled(repoName: string): Promise<{ installed: boolean; path?: string }> {
    const projectPath = gitOps.getProjectPath(repoName);
    try {
      await fs.access(projectPath);
      return { installed: true, path: projectPath };
    } catch {
      return { installed: false };
    }
  }
}

export const projectInstaller = new ProjectInstaller();
