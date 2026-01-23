import { simpleGit, SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { app } from 'electron';

interface CloneOptions {
  onProgress?: (message: string) => void;
}

class GitOperations {
  private baseDir: string;
  private configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.baseDir = path.join(process.env.APPDATA || process.env.HOME || '', '.localgithub', 'projects');
    this.loadBaseDir();
  }

  private async loadBaseDir(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      if (config.baseDir) {
        this.baseDir = config.baseDir;
      }
    } catch {
      // Config doesn't exist or is invalid, use default
    }
  }

  async setBaseDir(newBaseDir: string): Promise<void> {
    this.baseDir = newBaseDir;
    try {
      await this.ensureBaseDir();
      let config: any = {};
      try {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        config = JSON.parse(configData);
      } catch {
        // Config doesn't exist yet
      }
      config.baseDir = newBaseDir;
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to set base directory:', error);
      throw error;
    }
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

  async checkForRemoteChanges(repoName: string): Promise<{ hasChanges: boolean; ahead: number; behind: number }> {
    const projectPath = path.join(this.baseDir, repoName);
    try {
      await fs.access(projectPath);
      const git: SimpleGit = simpleGit(projectPath);
      
      // Get status WITHOUT fetching - much faster but may be stale
      // The UI can call fetchAndCheckRemoteChanges if it needs fresh data
      const status = await git.status();
      
      return {
        hasChanges: status.behind > 0,
        ahead: status.ahead,
        behind: status.behind
      };
    } catch (error) {
      console.error('Check remote changes error:', error);
      throw error;
    }
  }

  async fetchAndCheckRemoteChanges(repoName: string): Promise<{ hasChanges: boolean; ahead: number; behind: number }> {
    const projectPath = path.join(this.baseDir, repoName);
    try {
      await fs.access(projectPath);
      const git: SimpleGit = simpleGit(projectPath);
      
      // Fetch latest changes from remote without merging (slower but accurate)
      await git.fetch();
      
      // Get status to check if we're behind
      const status = await git.status();
      
      return {
        hasChanges: status.behind > 0,
        ahead: status.ahead,
        behind: status.behind
      };
    } catch (error) {
      console.error('Fetch and check remote changes error:', error);
      throw error;
    }
  }

  async pullChanges(repoName: string): Promise<{ success: boolean; message: string }> {
    const projectPath = path.join(this.baseDir, repoName);
    try {
      await fs.access(projectPath);
      const git: SimpleGit = simpleGit(projectPath);
      
      // Pull changes
      const result = await git.pull();
      
      if (result.summary.changes > 0 || result.summary.insertions > 0 || result.summary.deletions > 0) {
        return {
          success: true,
          message: `Pulled ${result.summary.changes} file(s) with ${result.summary.insertions} insertions and ${result.summary.deletions} deletions`
        };
      } else {
        return {
          success: true,
          message: 'Already up to date'
        };
      }
    } catch (error) {
      console.error('Pull changes error:', error);
      return {
        success: false,
        message: (error as Error).message
      };
    }
  }

  async linkExistingFolder(localPath: string, repoUrl: string, repoName: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify the folder exists
      await fs.access(localPath);
      
      // Check if it's already a git repository
      const git: SimpleGit = simpleGit(localPath);
      let isGitRepo = false;
      try {
        await git.status();
        isGitRepo = true;
      } catch {
        // Not a git repo, we'll initialize it
      }

      if (!isGitRepo) {
        // Initialize git repository
        await git.init();
        await git.addRemote('origin', repoUrl);
      } else {
        // Check if remote exists, if not add it
        const remotes = await git.getRemotes(true);
        const originExists = remotes.some(r => r.name === 'origin');
        if (!originExists) {
          await git.addRemote('origin', repoUrl);
        } else {
          // Update the remote URL
          await git.remote(['set-url', 'origin', repoUrl]);
        }
      }

      // Create a symlink or record the mapping
      const targetPath = path.join(this.baseDir, repoName);
      try {
        await fs.access(targetPath);
        // If target exists and is different from localPath, warn user
        if (path.resolve(targetPath) !== path.resolve(localPath)) {
          return {
            success: false,
            message: `A project named "${repoName}" already exists at a different location`
          };
        }
      } catch {
        // Target doesn't exist, create symlink
        try {
          await fs.symlink(localPath, targetPath, 'junction');
        } catch (symlinkError) {
          // If symlink fails, save a mapping instead
          await this.saveProjectMapping(repoName, localPath);
        }
      }

      return {
        success: true,
        message: `Successfully linked ${repoName} to ${localPath}`
      };
    } catch (error) {
      console.error('Link existing folder error:', error);
      return {
        success: false,
        message: (error as Error).message
      };
    }
  }

  private async saveProjectMapping(repoName: string, localPath: string): Promise<void> {
    try {
      let config: any = {};
      try {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        config = JSON.parse(configData);
      } catch {
        // Config doesn't exist yet
      }
      if (!config.projectMappings) {
        config.projectMappings = {};
      }
      config.projectMappings[repoName] = localPath;
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save project mapping:', error);
      throw error;
    }
  }

  async getProjectMapping(repoName: string): Promise<string | null> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      return config.projectMappings?.[repoName] || null;
    } catch {
      return null;
    }
  }

  async getProjectPathAsync(repoName: string): Promise<string> {
    // Check for mapping first
    const mapping = await this.getProjectMapping(repoName);
    if (mapping) return mapping;
    return path.join(this.baseDir, repoName);
  }

  async changeProjectLink(repoName: string, newLocalPath: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify the new folder exists
      await fs.access(newLocalPath);
      
      // Check if it's a git repository
      const git: SimpleGit = simpleGit(newLocalPath);
      try {
        await git.status();
      } catch {
        return {
          success: false,
          message: 'The selected folder is not a valid git repository'
        };
      }

      // Remove old symlink/mapping if exists
      const oldPath = await this.getProjectPathAsync(repoName);
      const symlinkPath = path.join(this.baseDir, repoName);
      
      try {
        const stats = await fs.lstat(symlinkPath);
        if (stats.isSymbolicLink() || stats.isDirectory()) {
          await fs.rm(symlinkPath, { recursive: true, force: true });
        }
      } catch {
        // No symlink exists, that's fine
      }

      // Create new symlink or update mapping
      try {
        await fs.symlink(newLocalPath, symlinkPath, 'junction');
      } catch (symlinkError) {
        // If symlink fails, update mapping
        await this.saveProjectMapping(repoName, newLocalPath);
      }

      return {
        success: true,
        message: `Successfully changed link for ${repoName} to ${newLocalPath}`
      };
    } catch (error) {
      console.error('Change project link error:', error);
      return {
        success: false,
        message: (error as Error).message
      };
    }
  }

  async removeProjectLink(repoName: string): Promise<{ success: boolean; message: string }> {
    try {
      const symlinkPath = path.join(this.baseDir, repoName);
      
      // Remove symlink if exists
      try {
        const stats = await fs.lstat(symlinkPath);
        if (stats.isSymbolicLink()) {
          await fs.unlink(symlinkPath);
        }
      } catch {
        // No symlink exists
      }

      // Remove mapping from config
      try {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        const config = JSON.parse(configData);
        if (config.projectMappings && config.projectMappings[repoName]) {
          delete config.projectMappings[repoName];
          await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
        }
      } catch {
        // Config doesn't exist or no mapping
      }

      return {
        success: true,
        message: `Successfully removed link for ${repoName}. The folder was not deleted.`
      };
    } catch (error) {
      console.error('Remove project link error:', error);
      return {
        success: false,
        message: (error as Error).message
      };
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
