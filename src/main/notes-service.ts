import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { githubService } from './github-service.js';

export interface ProjectNote {
  id: string;
  text: string;
  status: 'done' | 'pending' | 'in-progress';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNotes {
  repoName: string;
  notes: ProjectNote[];
  rawContent?: string;
  rawPath?: string;
}

class NotesService {
  private notesDir: string;

  constructor() {
    // Store notes in user data directory
    this.notesDir = path.join(app.getPath('userData'), 'notes');
    this.ensureNotesDir();
  }

  private ensureNotesDir(): void {
    if (!fs.existsSync(this.notesDir)) {
      fs.mkdirSync(this.notesDir, { recursive: true });
    }
  }

  private getNotesFilePath(repoName: string): string {
    // Sanitize repo name to be filesystem safe
    const safeName = repoName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.notesDir, `${safeName}.json`);
  }
  // Try multiple filename variants and also scan folder for matching repoName
  async getNotes(repoName: string): Promise<ProjectNotes> {
    const candidates = this.getCandidateNames(repoName);

    try {
      // Try candidate filenames first
      for (const candidate of candidates) {
        const filePath = path.join(this.notesDir, `${candidate}.json`);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          try {
            const parsed = JSON.parse(content);
            return parsed;
          } catch (err) {
            console.warn(`Invalid JSON in notes file ${filePath}:`, err);
            continue;
          }
        }
      }

      // Fallback: scan all files and return the one where repoName field matches
      const files = fs.readdirSync(this.notesDir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const full = path.join(this.notesDir, f);
        try {
          const content = fs.readFileSync(full, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed && parsed.repoName && String(parsed.repoName).toLowerCase() === String(repoName).toLowerCase()) {
            return parsed;
          }
        } catch (err) {
          // ignore parse errors
          continue;
        }
      }
    } catch (error) {
      console.error(`Error reading notes for ${repoName}:`, error);
    }

    // Return empty notes if not found
    return {
      repoName,
      notes: [],
    };
  }

  private getCandidateNames(repoName: string): string[] {
    const candidates = new Set<string>();
    if (!repoName) return [];
    candidates.add(repoName);
    candidates.add(repoName.toLowerCase());
    // sanitized as used elsewhere
    candidates.add(repoName.replace(/[^a-zA-Z0-9-_]/g, '_'));
    candidates.add(repoName.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '_'));
    // replace hyphens with underscores
    candidates.add(repoName.replace(/-/g, '_'));
    candidates.add(repoName.toLowerCase().replace(/-/g, '_'));

    // if repoName contains slash (owner/repo), add repo part and owner_repo
    if (repoName.includes('/')) {
      const parts = repoName.split('/');
      const owner = parts[0];
      const repo = parts[parts.length - 1];
      candidates.add(repo);
      candidates.add(`${owner}_${repo}`);
      candidates.add(`${owner}-${repo}`);
    }

    return Array.from(candidates);
  }

  async saveNotes(repoName: string, notes: ProjectNote[]): Promise<void> {
    const filePath = this.getNotesFilePath(repoName);
    
    const projectNotes: ProjectNotes = {
      repoName,
      notes,
    };

    try {
      this.ensureNotesDir();
      fs.writeFileSync(filePath, JSON.stringify(projectNotes, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error saving notes for ${repoName}:`, error);
      throw error;
    }
  }

  async deleteNotes(repoName: string): Promise<void> {
    const filePath = this.getNotesFilePath(repoName);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error deleting notes for ${repoName}:`, error);
      throw error;
    }
  }

  async addNote(repoName: string, text: string): Promise<ProjectNote> {
    const projectNotes = await this.getNotes(repoName);
    
    const newNote: ProjectNote = {
      id: this.generateId(),
      text,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projectNotes.notes.push(newNote);
    await this.saveNotes(repoName, projectNotes.notes);
    
    return newNote;
  }

  async updateNote(repoName: string, noteId: string, updates: Partial<Pick<ProjectNote, 'text' | 'status'>>): Promise<ProjectNote | null> {
    const projectNotes = await this.getNotes(repoName);
    
    const noteIndex = projectNotes.notes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) {
      return null;
    }

    projectNotes.notes[noteIndex] = {
      ...projectNotes.notes[noteIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveNotes(repoName, projectNotes.notes);
    
    return projectNotes.notes[noteIndex];
  }

  async deleteNote(repoName: string, noteId: string): Promise<boolean> {
    const projectNotes = await this.getNotes(repoName);
    
    const initialLength = projectNotes.notes.length;
    projectNotes.notes = projectNotes.notes.filter(n => n.id !== noteId);
    
    if (projectNotes.notes.length !== initialLength) {
      await this.saveNotes(repoName, projectNotes.notes);
      return true;
    }
    
    return false;
  }

  private generateId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Fetch notes file from GitHub repository. Tries several filenames and returns parsed notes.
  async fetchNotesFromRepoName(repoName: string): Promise<ProjectNotes> {
    try {
      // Support passing either "repoName" or "owner/repo" (full_name)
      if (repoName.includes('/')) {
        const parts = repoName.split('/');
        const owner = parts[0];
        const repo = parts.slice(1).join('/');
        return await this.fetchNotesFromRepo(owner, repo);
      }

      const user = await githubService.getCurrentUser();
      const owner = user.login;
      return await this.fetchNotesFromRepo(owner, repoName);
    } catch (error) {
      console.error('Failed to determine owner for repo notes lookup:', error);
      return { repoName, notes: [] };
    }
  }

  async fetchNotesFromRepo(owner: string, repo: string): Promise<ProjectNotes> {
    const possiblePaths = [
      'notes.txt',
      'Notes.txt',
      'NOTES.txt',
      'notes.md',
      'Notes.md',
      'NOTES.md',
      'notes.json',
      'notes/notes.json',
      'docs/NOTES.md',
      'docs/notes.md',
    ];

    for (const p of possiblePaths) {
      try {
        const content = await githubService.getRawFileContent(owner, repo, p);
        if (content) {
          console.info(`Found notes file in ${owner}/${repo}/${p} (len=${content.length})`);
          // Return the whole file as a single raw note (do not assume TODO/done sections)
          const note: ProjectNote = {
            id: this.generateId(),
            text: content,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const projectNotes: ProjectNotes = { repoName: repo, notes: [note], rawContent: content, rawPath: p };
          // Save a local copy for offline use
          await this.saveNotes(repo, projectNotes.notes);
          console.info(`Saved raw notes copy for ${owner}/${repo} from ${p}`);
          return projectNotes;
        }
      } catch (err) {
        // continue trying other paths
        continue;
      }
    }

    // If not found, return empty
    return { repoName: repo, notes: [] };
  }

  // Simple parser: split sections by DONE / MISSING headers and collect list items
  private parseNotesContent(repoName: string, content: string): ProjectNotes {
    const lines = content.split(/\r?\n/).map(l => l.trim());
    const notes: ProjectNote[] = [];
    let section: 'done' | 'pending' | 'in-progress' | null = null;

    for (const line of lines) {
      if (!line) continue;
      const upper = line.toUpperCase();
      if (upper.startsWith('DONE') || upper.startsWith('✅ DONE') || upper.startsWith('COMPLETED')) {
        section = 'done';
        continue;
      }
      if (upper.startsWith('MISSING') || upper.startsWith('TODO') || upper.startsWith('INCOMPLETE') || upper.startsWith('❌')) {
        section = 'pending';
        continue;
      }

      // lines that look like list items
      const itemMatch = line.match(/^-\s*(.*)$/) || line.match(/^\[.\]\s*(.*)$/) || line.match(/^[-•]\s*(.*)$/) || line.match(/^\d+\.\s*(.*)$/);
      const text = itemMatch ? itemMatch[1] : line;
      if (text) {
        notes.push({
          id: this.generateId(),
          text: text.replace(/`/g, ''),
          status: section || 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return { repoName, notes };
  }
}

export const notesService = new NotesService();
