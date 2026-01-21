import { useState, useEffect } from 'react';
import {
  Plus,
  Check,
  Clock,
  Loader,
  Trash2,
  Edit3,
  Save,
  X,
  ListTodo,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';
import '../styles/ProjectNotes.css';

interface ProjectNote {
  id: string;
  text: string;
  status: 'done' | 'pending' | 'in-progress';
  createdAt: string;
  updatedAt: string;
}

interface ProjectNotesProps {
  repoName: string;
}

type FilterStatus = 'all' | 'done' | 'pending' | 'in-progress';

function ProjectNotes({ repoName }: ProjectNotesProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [saving, setSaving] = useState(false);
  const [rawContent, setRawContent] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, [repoName]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const result = await (window as any).electronAPI.notes.get(repoName);
      if (result.success) {
        const local = result.data.notes || [];
        const localRaw = result.data.rawContent;
        
        // Prioritize showing raw content if it exists
        if (localRaw) {
          setRawContent(localRaw);
          setNotes([]);
        } else if (local.length > 0 && !local.some((note: ProjectNote) => note.text.includes('\n') && note.text.length > 200)) {
          // Only show as structured notes if they're actual notes (not raw file content)
          setNotes(local);
          setRawContent(null);
        } else if (local.length === 1 && local[0].text.length > 100) {
          // If there's a single long note, it's probably raw content
          setRawContent(local[0].text);
          setNotes([]);
        } else if (local.length > 0) {
          setNotes(local);
          setRawContent(null);
        } else {
          // Try fetching from repository if no local notes
          try {
            const remote = await (window as any).electronAPI.notes.fetchFromRepo(repoName);
            if (remote.success && remote.data) {
              if (remote.data.rawContent) {
                setRawContent(remote.data.rawContent);
                setNotes([]);
              } else if (remote.data.notes && remote.data.notes.length > 0) {
                setNotes(remote.data.notes);
                setRawContent(null);
              } else {
                setNotes([]);
                setRawContent(null);
              }
            }
          } catch (err) {
            console.error('Error fetching notes from repo:', err);
            setNotes([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    try {
      setSaving(true);
      const result = await (window as any).electronAPI.notes.add(repoName, newNoteText.trim());
      if (result.success) {
        setNotes([...notes, result.data]);
        setNewNoteText('');
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (noteId: string, status: ProjectNote['status']) => {
    try {
      const result = await (window as any).electronAPI.notes.update(repoName, noteId, { status });
      if (result.success && result.data) {
        setNotes(notes.map(n => n.id === noteId ? result.data : n));
      }
    } catch (error) {
      console.error('Error updating note status:', error);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!editText.trim()) return;

    try {
      setSaving(true);
      const result = await (window as any).electronAPI.notes.update(repoName, noteId, { text: editText.trim() });
      if (result.success && result.data) {
        setNotes(notes.map(n => n.id === noteId ? result.data : n));
        setEditingId(null);
        setEditText('');
      }
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const result = await (window as any).electronAPI.notes.delete(repoName, noteId);
      if (result.success) {
        setNotes(notes.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const startEditing = (note: ProjectNote) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      action();
    }
  };

  const filteredNotes = notes.filter(note => {
    if (filter === 'all') return true;
    return note.status === filter;
  });

  const getStatusIcon = (status: ProjectNote['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 size={16} className="status-icon done" />;
      case 'in-progress':
        return <AlertCircle size={16} className="status-icon in-progress" />;
      default:
        return <Circle size={16} className="status-icon pending" />;
    }
  };

  const getStatusCounts = () => {
    const counts = { done: 0, pending: 0, 'in-progress': 0 };
    notes.forEach(note => {
      counts[note.status]++;
    });
    return counts;
  };

  const counts = getStatusCounts();

  if (loading) {
    return (
      <div className="project-notes loading">
        <Loader size={24} className="spin" />
        <span>Loading notes...</span>
      </div>
    );
  }

  return (
    <div className="project-notes">
      <div className="notes-header">
        <div className="notes-title">
          <ListTodo size={20} />
          <h3>Project Notes</h3>
          <span className="notes-count">{notes.length}</span>
        </div>
        <div className="notes-summary">
          <span className="summary-item done">
            <Check size={14} /> {counts.done} done
          </span>
          <span className="summary-item in-progress">
            <Clock size={14} /> {counts['in-progress']} in progress
          </span>
          <span className="summary-item pending">
            <Circle size={14} /> {counts.pending} pending
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notes-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({notes.length})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({counts.pending})
        </button>
        <button
          className={`filter-btn ${filter === 'in-progress' ? 'active' : ''}`}
          onClick={() => setFilter('in-progress')}
        >
          In Progress ({counts['in-progress']})
        </button>
        <button
          className={`filter-btn ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter('done')}
        >
          Done ({counts.done})
        </button>
      </div>

      {/* Add Note Input (hidden when showing raw file content) */}
      {!rawContent && (
        <div className="add-note-form">
          <input
            type="text"
            placeholder="Add a new note (e.g., 'Implement user authentication')"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleAddNote)}
            disabled={saving}
          />
          <button
            className="btn btn-primary add-note-btn"
            onClick={handleAddNote}
            disabled={!newNoteText.trim() || saving}
          >
            {saving ? <Loader size={16} className="spin" /> : <Plus size={16} />}
            Add
          </button>
        </div>
      )}

      {/* Notes List or Raw File Content */}
      <div className="notes-list">
        {rawContent ? (
          <div className="notes-raw">
            <pre className="raw-content">{rawContent}</pre>
          </div>
        ) : (
          (filteredNotes.length === 0 ? (
            <div className="notes-empty">
              {filter === 'all' ? (
                <>
                  <ListTodo size={32} />
                  <p>No notes yet</p>
                  <span>Add notes to track what's done and what's missing</span>
                </>
              ) : (
                <>
                  <p>No {filter} notes</p>
                </>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div key={note.id} className={`note-item ${note.status}`}>
                {editingId === note.id ? (
                  <div className="note-edit">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleEditNote(note.id))}
                      autoFocus
                    />
                    <div className="note-edit-actions">
                      <button
                        className="btn-icon save"
                        onClick={() => handleEditNote(note.id)}
                        disabled={saving}
                      >
                        <Save size={14} />
                      </button>
                      <button className="btn-icon cancel" onClick={cancelEditing}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-content">
                      {getStatusIcon(note.status)}
                      <span className={`note-text ${note.status === 'done' ? 'completed' : ''}`}>
                        {note.text}
                      </span>
                    </div>
                    <div className="note-actions">
                      <select
                        value={note.status}
                        onChange={(e) => handleUpdateStatus(note.id, e.target.value as ProjectNote['status'])}
                        className="status-select"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button
                        className="btn-icon edit"
                        onClick={() => startEditing(note)}
                        title="Edit note"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="btn-icon delete"
                        onClick={() => handleDeleteNote(note.id)}
                        title="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectNotes;
