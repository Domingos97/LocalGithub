import { ipcMain, shell, dialog } from 'electron';
import { spawn } from 'child_process';
import { githubService } from './github-service.js';
import { projectDetector } from './project-detector.js';
import { processManager } from './process-manager.js';
import { gitOps, installer } from './git-operations.js';
import { projectInstaller } from './project-installer.js';
import { notesService } from './notes-service.js';
import { projectGroupsService } from './project-groups-service.js';

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

  // Batch check multiple projects at once
  ipcMain.handle('project:batchCheck', async (_event, repoNames: string[]) => {
    try {
      const results = await Promise.all(
        repoNames.map(async (repoName) => {
          try {
            const installed = await projectInstaller.isProjectInstalled(repoName);
            let projectPath = null;
            if (installed.installed) {
              projectPath = gitOps.getProjectPath(repoName);
            }
            return {
              name: repoName,
              installed: installed.installed,
              path: projectPath
            };
          } catch (error) {
            return {
              name: repoName,
              installed: false,
              path: null,
              error: (error as Error).message
            };
          }
        })
      );
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Uninstall/delete a project
  ipcMain.handle('project:uninstall', async (_event, repoName: string) => {
    try {
      // First, stop any processes managed by ProcessManager for this project
      const stoppedManaged = processManager.stopProcessesForProject(repoName);
      console.log(`Stopped ${stoppedManaged} managed process(es) for ${repoName}`);

      // Get the project path to find orphaned processes
      const projectPath = gitOps.getProjectPath(repoName);
      
      // Kill any orphaned system processes (electron, node) running from this project
      const killedOrphaned = await processManager.killOrphanedProcesses(projectPath);
      console.log(`Killed ${killedOrphaned} orphaned process(es) for ${repoName}`);

      // Small delay to ensure file handles are released
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now delete the project
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

  // Set the base directory where projects are installed
  ipcMain.handle('project:setBaseDir', async (_event, newBaseDir) => {
    try {
      await gitOps.setBaseDir(newBaseDir);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Link an existing folder to a repository
  ipcMain.handle('project:linkExisting', async (_event, localPath, repoUrl, repoName) => {
    try {
      const result = await gitOps.linkExistingFolder(localPath, repoUrl, repoName);
      return result;
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  // Change the folder link for a project
  ipcMain.handle('project:changeLink', async (_event, repoName, newLocalPath) => {
    try {
      const result = await gitOps.changeProjectLink(repoName, newLocalPath);
      return result;
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  // Remove the folder link for a project (without deleting the folder)
  ipcMain.handle('project:removeLink', async (_event, repoName) => {
    try {
      const result = await gitOps.removeProjectLink(repoName);
      return result;
    } catch (error) {
      return { success: false, message: (error as Error).message };
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

  // Check for remote changes (fast - no fetch)
  ipcMain.handle('git:checkRemoteChanges', async (_event, repoName) => {
    try {
      const result = await gitOps.checkForRemoteChanges(repoName);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Fetch and check for remote changes (slow but accurate)
  ipcMain.handle('git:fetchAndCheckRemoteChanges', async (_event, repoName) => {
    try {
      const result = await gitOps.fetchAndCheckRemoteChanges(repoName);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Pull remote changes
  ipcMain.handle('git:pull', async (_event, repoName) => {
    try {
      const result = await gitOps.pullChanges(repoName);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
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

  // Notes Handlers
  ipcMain.handle('notes:get', async (_event, repoName: string) => {
    console.debug('IPC notes:get called for', repoName);
    try {
      const notes = await notesService.getNotes(repoName);
      return { success: true, data: notes };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('notes:save', async (_event, repoName: string, notes: any[]) => {
    try {
      await notesService.saveNotes(repoName, notes);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('notes:add', async (_event, repoName: string, text: string) => {
    try {
      const note = await notesService.addNote(repoName, text);
      return { success: true, data: note };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('notes:update', async (_event, repoName: string, noteId: string, updates: any) => {
    try {
      const note = await notesService.updateNote(repoName, noteId, updates);
      return { success: true, data: note };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('notes:delete', async (_event, repoName: string, noteId: string) => {
    try {
      const success = await notesService.deleteNote(repoName, noteId);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Fetch notes from the GitHub repository (notes.txt / NOTES.md / notes.json)
  ipcMain.handle('notes:fetchFromRepo', async (_event, repoName: string) => {
    console.debug('IPC notes:fetchFromRepo called for', repoName);
    try {
      const notes = await notesService.fetchNotesFromRepoName(repoName);
      console.debug('notes:fetchFromRepo result for', repoName, '->', (notes.notes || []).length, 'items');
      return { success: true, data: notes };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Dialog handlers
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    return { success: true, path: result.filePaths[0] };
  });

  ipcMain.handle('dialog:showOpenDialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(options);
    return {
      canceled: result.canceled,
      filePaths: result.filePaths
    };
  });

  // Project Groups Handlers
  ipcMain.handle('groups:getAll', async () => {
    try {
      const groups = await projectGroupsService.getAllGroups();
      return { success: true, data: groups };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:get', async (_event, groupId: string) => {
    try {
      const group = await projectGroupsService.getGroup(groupId);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:create', async (_event, name: string, description?: string, color?: string) => {
    try {
      const group = await projectGroupsService.createGroup(name, description, color);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:update', async (_event, groupId: string, updates: any) => {
    try {
      const group = await projectGroupsService.updateGroup(groupId, updates);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:delete', async (_event, groupId: string) => {
    try {
      const success = await projectGroupsService.deleteGroup(groupId);
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:addRepo', async (_event, groupId: string, repoName: string) => {
    try {
      const group = await projectGroupsService.addRepoToGroup(groupId, repoName);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:removeRepo', async (_event, groupId: string, repoName: string) => {
    try {
      const group = await projectGroupsService.removeRepoFromGroup(groupId, repoName);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:getForRepo', async (_event, repoName: string) => {
    try {
      const group = await projectGroupsService.getGroupForRepo(repoName);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('groups:moveRepo', async (_event, repoName: string, targetGroupId: string) => {
    try {
      const group = await projectGroupsService.moveRepoToGroup(repoName, targetGroupId);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
