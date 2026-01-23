import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // GitHub APIs
  github: {
    validateToken: () => ipcRenderer.invoke('github:validateToken'),
    getCurrentUser: () => ipcRenderer.invoke('github:getCurrentUser'),
    getAllRepositories: () => ipcRenderer.invoke('github:getAllRepositories'),
    getRepository: (repoName: string) => ipcRenderer.invoke('github:getRepository', repoName),
  },

  // Project Detection & Installation
  project: {
    detectType: (repo: any) => ipcRenderer.invoke('project:detectType', repo),
    install: (repoUrl: string, repoName: string) => 
      ipcRenderer.invoke('project:install', repoUrl, repoName),
    isInstalled: (repoName: string) => 
      ipcRenderer.invoke('project:isInstalled', repoName),
    getConfig: (projectPath: string) => 
      ipcRenderer.invoke('project:getConfig', projectPath),
    getBaseDir: () => ipcRenderer.invoke('project:getBaseDir'),
    setBaseDir: (newBaseDir: string) => ipcRenderer.invoke('project:setBaseDir', newBaseDir),
    linkExisting: (localPath: string, repoUrl: string, repoName: string) => 
      ipcRenderer.invoke('project:linkExisting', localPath, repoUrl, repoName),
    changeLink: (repoName: string, newLocalPath: string) => 
      ipcRenderer.invoke('project:changeLink', repoName, newLocalPath),
    removeLink: (repoName: string) => 
      ipcRenderer.invoke('project:removeLink', repoName),
    openInVSCode: (projectPath: string) => 
      ipcRenderer.invoke('project:openInVSCode', projectPath),
    uninstall: (repoName: string) => 
      ipcRenderer.invoke('project:uninstall', repoName),
    onInstallProgress: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('project:installProgress', handler);
      return () => ipcRenderer.removeListener('project:installProgress', handler);
    },
  },

  // Git Operations
  git: {
    cloneRepository: (url: string, name: string) =>
      ipcRenderer.invoke('git:cloneRepository', url, name),
    getProjectPath: (name: string) => ipcRenderer.invoke('git:getProjectPath', name),
    checkRemoteChanges: (repoName: string) => 
      ipcRenderer.invoke('git:checkRemoteChanges', repoName),
    pull: (repoName: string) => 
      ipcRenderer.invoke('git:pull', repoName),
    onCloneProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('git:cloneProgress', (_event, data) => callback(data));
    },
  },

  // Installer
  installer: {
    installDependencies: (projectPath: string, packageManager: string) =>
      ipcRenderer.invoke('installer:installDependencies', projectPath, packageManager),
    build: (projectPath: string, buildCommand: string) =>
      ipcRenderer.invoke('installer:build', projectPath, buildCommand),
    onProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('installer:progress', (_event, data) => callback(data));
    },
    onBuildProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('installer:buildProgress', (_event, data) => callback(data));
    },
  },

  // Process Management
  process: {
    start: (projectName: string, command: string, cwd: string, port: number, type: string) =>
      ipcRenderer.invoke('process:start', projectName, command, cwd, port, type),
    stop: (processId: string) => ipcRenderer.invoke('process:stop', processId),
    getAll: () => ipcRenderer.invoke('process:getAll'),
    get: (processId: string) => ipcRenderer.invoke('process:get', processId),
    stopAll: () => ipcRenderer.invoke('process:stopAll'),
    onOutput: (callback: (data: any) => void) => {
      ipcRenderer.on('process:output', (_event, data) => callback(data));
    },
  },

  // Notes Management
  notes: {
    get: (repoName: string) => ipcRenderer.invoke('notes:get', repoName),
    save: (repoName: string, notes: any[]) => ipcRenderer.invoke('notes:save', repoName, notes),
    add: (repoName: string, text: string) => ipcRenderer.invoke('notes:add', repoName, text),
    update: (repoName: string, noteId: string, updates: any) =>
      ipcRenderer.invoke('notes:update', repoName, noteId, updates),
    delete: (repoName: string, noteId: string) =>
      ipcRenderer.invoke('notes:delete', repoName, noteId),
    fetchFromRepo: (repoName: string) => ipcRenderer.invoke('notes:fetchFromRepo', repoName),
  },

  // Dialog APIs
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  },

  // Project Groups Management
  groups: {
    getAll: () => ipcRenderer.invoke('groups:getAll'),
    get: (groupId: string) => ipcRenderer.invoke('groups:get', groupId),
    create: (name: string, description?: string, color?: string) => 
      ipcRenderer.invoke('groups:create', name, description, color),
    update: (groupId: string, updates: any) => 
      ipcRenderer.invoke('groups:update', groupId, updates),
    delete: (groupId: string) => ipcRenderer.invoke('groups:delete', groupId),
    addRepo: (groupId: string, repoName: string) => 
      ipcRenderer.invoke('groups:addRepo', groupId, repoName),
    removeRepo: (groupId: string, repoName: string) => 
      ipcRenderer.invoke('groups:removeRepo', groupId, repoName),
    getForRepo: (repoName: string) => 
      ipcRenderer.invoke('groups:getForRepo', repoName),
    moveRepo: (repoName: string, targetGroupId: string) => 
      ipcRenderer.invoke('groups:moveRepo', repoName, targetGroupId),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
