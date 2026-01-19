import { ipcMain, shell } from 'electron';
import { spawn } from 'child_process';
import { githubService } from './github-service.js';
import { projectDetector } from './project-detector.js';
import { processManager } from './process-manager.js';
import { gitOps, installer } from './git-operations.js';
import { projectInstaller } from './project-installer.js';

export function registerIpcHandlers() {
  // GitHub API Handlers
  ipcMain.handle('github:validateToken', async () => {
    try {
      const isValid = await githubService.validateToken();
      return { success: isValid };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('github:getCurrentUser', async () => {
    try {
      const user = await githubService.getCurrentUser();
      return { success: true, data: user };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('github:getAllRepositories', async () => {
    try {
      const repos = await githubService.getAllUserRepositories();
      return { success: true, data: repos };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('github:getRepository', async (_event, repoName) => {
    try {
      const repo = await githubService.getRepository(repoName);
      return { success: true, data: repo };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Project Detection Handlers
  ipcMain.handle('project:detectType', async (_event, repo) => {
    try {
      const projectType = await projectDetector.detectProjectType(repo);
      return { success: true, data: projectType };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Project Installation Handler (unified clone + detect + install)
  ipcMain.handle('project:install', async (_event, repoUrl, repoName) => {
    try {
      const result = await projectInstaller.installProject(repoUrl, repoName, (progress) => {
        _event.sender.send('project:installProgress', progress);
      });
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Check if project is installed
  ipcMain.handle('project:isInstalled', async (_event, repoName) => {
    try {
      const result = await projectInstaller.isProjectInstalled(repoName);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Uninstall/delete a project
  ipcMain.handle('project:uninstall', async (_event, repoName: string) => {
    try {
      await gitOps.deleteProject(repoName);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get install config for a local project
  ipcMain.handle('project:getConfig', async (_event, projectPath) => {
    try {
      const config = await projectInstaller.detectProjectConfig(projectPath);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get the base directory where projects are installed
  ipcMain.handle('project:getBaseDir', async () => {
    try {
      const baseDir = gitOps.getBaseDir();
      return { success: true, data: { path: baseDir } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Git Operations Handlers
  ipcMain.handle('git:cloneRepository', async (_event, repoUrl, repoName) => {
    try {
      const projectPath = await gitOps.cloneRepository(repoUrl, repoName, {
        onProgress: (message) => {
          _event.sender.send('git:cloneProgress', { message });
        },
      });
      return { success: true, data: { projectPath } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('git:getProjectPath', async (_event, repoName) => {
    const projectPath = gitOps.getProjectPath(repoName);
    return { success: true, data: { projectPath } };
  });

  // Installer Handlers
  ipcMain.handle('installer:installDependencies', async (_event, projectPath, packageManager) => {
    try {
      await installer.installDependencies(projectPath, packageManager, {
        onProgress: (message) => {
          _event.sender.send('installer:progress', { message });
        },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('installer:build', async (_event, projectPath, buildCommand) => {
    try {
      await installer.buildProject(projectPath, buildCommand, {
        onProgress: (message) => {
          _event.sender.send('installer:buildProgress', { message });
        },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Process Manager Handlers
  ipcMain.handle(
    'process:start',
    async (_event, projectName, command, cwd, port, type) => {
      try {
        processManager.on('output', ({ processId, output }) => {
          _event.sender.send('process:output', { processId, output });
        });

        const process = await processManager.startProcess(
          projectName,
          command,
          cwd,
          port,
          type
        );
        return { success: true, data: process };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('process:stop', async (_event, processId) => {
    try {
      const success = processManager.stopProcess(processId);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('process:getAll', async () => {
    try {
      const processes = processManager.getAllProcesses();
      return { success: true, data: processes };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('process:get', async (_event, processId) => {
    try {
      const process = processManager.getProcess(processId);
      return { success: true, data: process };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('process:stopAll', async () => {
    try {
      processManager.stopAllProcesses();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Open project in VS Code
  ipcMain.handle('project:openInVSCode', async (_event, projectPath: string) => {
    try {
      // Use spawn to run 'code' command which opens VS Code
      const child = spawn('code', [projectPath], {
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
