import { simpleGit, SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';

interface CloneOptions {
  onProgress?: (message: string) => void;
}

class GitOperations {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.env.APPDATA || process.env.HOME || '', '.localgithub', 'projects');
  }

  async cloneRepository(
    repoUrl: string,
    repoName: string,
    options?: CloneOptions
  ): Promise<string> {
    try {
      await this.ensureBaseDir();

      const projectPath = path.join(this.baseDir, repoName);

      // Check if already cloned
      try {
        await fs.access(projectPath);
        options?.onProgress?.('Repository already exists, pulling latest changes...');
        const git: SimpleGit = simpleGit(projectPath);
        await git.pull();
        return projectPath;
      } catch {
        // Directory doesn't exist, proceed with clone
      }

      options?.onProgress?.(`Cloning repository to ${projectPath}...`);

      const git: SimpleGit = simpleGit();
      await git.clone(repoUrl, projectPath);

      options?.onProgress?.('Clone completed successfully');
      return projectPath;
    } catch (error) {
      console.error('Clone error:', error);
      throw error;
    }
  }

  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  getProjectPath(repoName: string): string {
    return path.join(this.baseDir, repoName);
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  async deleteProject(repoName: string): Promise<void> {
    const projectPath = path.join(this.baseDir, repoName);
    try {
      await fs.access(projectPath);
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }
}

interface InstallOptions {
  onProgress?: (message: string) => void;
}

class Installer {
  async installDependencies(
    projectPath: string,
    packageManager: string,
    options?: InstallOptions
  ): Promise<void> {
    try {
      options?.onProgress?.(`Installing dependencies using ${packageManager}...`);

      let command: string;

      switch (packageManager.toLowerCase()) {
        case 'npm':
          command = 'npm install';
          break;
        case 'yarn':
          command = 'yarn install';
          break;
        case 'pnpm':
          command = 'pnpm install';
          break;
        case 'pip':
          command = 'pip install -r requirements.txt';
          break;
        case 'cargo':
          command = 'cargo build';
          break;
        default:
          throw new Error(`Unknown package manager: ${packageManager}`);
      }

      options?.onProgress?.(`Running: ${command}`);

      execSync(command, {
        cwd: projectPath,
        stdio: 'inherit',
      });

      options?.onProgress?.('Dependencies installed successfully');
    } catch (error) {
      console.error('Installation error:', error);
      throw error;
    }
  }

  async buildProject(projectPath: string, buildCommand: string, options?: InstallOptions): Promise<void> {
    try {
      if (!buildCommand) {
        options?.onProgress?.('No build command specified, skipping build');
        return;
      }

      options?.onProgress?.(`Building project with: ${buildCommand}`);

      execSync(buildCommand, {
        cwd: projectPath,
        stdio: 'inherit',
      });

      options?.onProgress?.('Build completed successfully');
    } catch (error) {
      console.error('Build error:', error);
      throw error;
    }
  }
}

export { GitOperations, Installer };
const gitOps = new GitOperations();
const installer = new Installer();
export { gitOps, installer };
