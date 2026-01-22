import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface ProjectGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  repoNames: string[]; // Array of repository names
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGroupsData {
  groups: ProjectGroup[];
}

class ProjectGroupsService {
  private groupsFilePath: string;

  constructor() {
    const userDataDir = app.getPath('userData');
    this.groupsFilePath = path.join(userDataDir, 'project-groups.json');
    this.ensureGroupsFile();
  }

  private ensureGroupsFile(): void {
    if (!fs.existsSync(this.groupsFilePath)) {
      const initialData: ProjectGroupsData = { groups: [] };
      fs.writeFileSync(this.groupsFilePath, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }

  private readGroupsData(): ProjectGroupsData {
    try {
      const content = fs.readFileSync(this.groupsFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading project groups:', error);
      return { groups: [] };
    }
  }

  private writeGroupsData(data: ProjectGroupsData): void {
    try {
      fs.writeFileSync(this.groupsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing project groups:', error);
      throw error;
    }
  }

  async getAllGroups(): Promise<ProjectGroup[]> {
    const data = this.readGroupsData();
    return data.groups;
  }

  async getGroup(groupId: string): Promise<ProjectGroup | null> {
    const data = this.readGroupsData();
    return data.groups.find(g => g.id === groupId) || null;
  }

  async createGroup(name: string, description?: string, color?: string): Promise<ProjectGroup> {
    const data = this.readGroupsData();
    
    const newGroup: ProjectGroup = {
      id: this.generateId(),
      name,
      description,
      color: color || this.getRandomColor(),
      repoNames: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.groups.push(newGroup);
    this.writeGroupsData(data);
    
    return newGroup;
  }

  async updateGroup(groupId: string, updates: Partial<Pick<ProjectGroup, 'name' | 'description' | 'color'>>): Promise<ProjectGroup | null> {
    const data = this.readGroupsData();
    const groupIndex = data.groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return null;
    }

    data.groups[groupIndex] = {
      ...data.groups[groupIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.writeGroupsData(data);
    return data.groups[groupIndex];
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const data = this.readGroupsData();
    const initialLength = data.groups.length;
    data.groups = data.groups.filter(g => g.id !== groupId);
    
    if (data.groups.length !== initialLength) {
      this.writeGroupsData(data);
      return true;
    }
    
    return false;
  }

  async addRepoToGroup(groupId: string, repoName: string): Promise<ProjectGroup | null> {
    const data = this.readGroupsData();
    const groupIndex = data.groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return null;
    }

    // Remove repo from any other groups first
    data.groups.forEach((group, index) => {
      if (index !== groupIndex) {
        group.repoNames = group.repoNames.filter(name => name !== repoName);
      }
    });

    // Add to the target group if not already there
    if (!data.groups[groupIndex].repoNames.includes(repoName)) {
      data.groups[groupIndex].repoNames.push(repoName);
      data.groups[groupIndex].updatedAt = new Date().toISOString();
    }

    this.writeGroupsData(data);
    return data.groups[groupIndex];
  }

  async removeRepoFromGroup(groupId: string, repoName: string): Promise<ProjectGroup | null> {
    const data = this.readGroupsData();
    const groupIndex = data.groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return null;
    }

    data.groups[groupIndex].repoNames = data.groups[groupIndex].repoNames.filter(name => name !== repoName);
    data.groups[groupIndex].updatedAt = new Date().toISOString();

    this.writeGroupsData(data);
    return data.groups[groupIndex];
  }

  async getGroupForRepo(repoName: string): Promise<ProjectGroup | null> {
    const data = this.readGroupsData();
    return data.groups.find(g => g.repoNames.includes(repoName)) || null;
  }

  async moveRepoToGroup(repoName: string, targetGroupId: string): Promise<ProjectGroup | null> {
    const data = this.readGroupsData();
    
    // Remove from all groups
    data.groups.forEach(group => {
      group.repoNames = group.repoNames.filter(name => name !== repoName);
    });

    // Add to target group
    const groupIndex = data.groups.findIndex(g => g.id === targetGroupId);
    if (groupIndex === -1) {
      return null;
    }

    data.groups[groupIndex].repoNames.push(repoName);
    data.groups[groupIndex].updatedAt = new Date().toISOString();

    this.writeGroupsData(data);
    return data.groups[groupIndex];
  }

  private generateId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRandomColor(): string {
    const colors = [
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#06b6d4', // cyan
      '#f97316', // orange
      '#84cc16', // lime
      '#6366f1', // indigo
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const projectGroupsService = new ProjectGroupsService();
