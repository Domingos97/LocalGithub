import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Folder, Check } from 'lucide-react';
import '../styles/ProjectGroupsModal.css';

interface ProjectGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  repoNames: string[];
  createdAt: string;
  updatedAt: string;
}

interface Repository {
  name: string;
  full_name?: string;
}

interface ProjectGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: Repository[];
  onGroupsChanged: () => void;
}

function ProjectGroupsModal({ isOpen, onClose, repositories, onGroupsChanged }: ProjectGroupsModalProps) {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedGroupForRepos, setSelectedGroupForRepos] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  const loadGroups = async () => {
    try {
      const result = await (window as any).electronAPI.groups.getAll();
      if (result.success) {
        setGroups(result.data || []);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const result = await (window as any).electronAPI.groups.create(
        newGroupName.trim(),
        newGroupDescription.trim() || undefined,
        selectedColor
      );
      
      if (result.success) {
        setGroups([...groups, result.data]);
        setNewGroupName('');
        setNewGroupDescription('');
        setSelectedColor('#3b82f6');
        setIsCreating(false);
        onGroupsChanged();
      }
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? Repositories will not be deleted, just ungrouped.')) {
      return;
    }

    try {
      const result = await (window as any).electronAPI.groups.delete(groupId);
      if (result.success) {
        setGroups(groups.filter(g => g.id !== groupId));
        onGroupsChanged();
      }
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const handleToggleRepo = async (groupId: string, repoName: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    try {
      if (group.repoNames.includes(repoName)) {
        const result = await (window as any).electronAPI.groups.removeRepo(groupId, repoName);
        if (result.success && result.data) {
          setGroups(groups.map(g => g.id === groupId ? result.data : g));
          onGroupsChanged();
        }
      } else {
        const result = await (window as any).electronAPI.groups.addRepo(groupId, repoName);
        if (result.success && result.data) {
          setGroups(groups.map(g => {
            // Remove from other groups
            if (g.id !== groupId && g.repoNames.includes(repoName)) {
              return { ...g, repoNames: g.repoNames.filter(r => r !== repoName) };
            }
            return g.id === groupId ? result.data : g;
          }));
          onGroupsChanged();
        }
      }
    } catch (error) {
      console.error('Error toggling repo:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="project-groups-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Folder size={24} /> Manage Project Groups</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Create New Group Section */}
          <div className="create-group-section">
            {!isCreating ? (
              <button className="create-group-button" onClick={() => setIsCreating(true)}>
                <Plus size={18} /> Create New Group
              </button>
            ) : (
              <div className="group-form">
                <input
                  type="text"
                  placeholder="Group name (e.g., 'E-commerce Platform')"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="group-name-input"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="group-description-input"
                />
                <div className="color-picker-section">
                  <label>Color:</label>
                  <div className="color-options">
                    {colors.map(color => (
                      <button
                        key={color}
                        className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-actions">
                  <button className="save-button" onClick={handleCreateGroup}>
                    <Check size={16} /> Create
                  </button>
                  <button className="cancel-button" onClick={() => {
                    setIsCreating(false);
                    setNewGroupName('');
                    setNewGroupDescription('');
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Groups List */}
          <div className="groups-list">
            {groups.length === 0 ? (
              <div className="no-groups">
                <Folder size={48} />
                <p>No groups yet. Create one to organize your repositories!</p>
              </div>
            ) : (
              groups.map(group => (
                <div key={group.id} className="group-item">
                  <div className="group-header">
                    <div className="group-info">
                      <div className="group-color" style={{ backgroundColor: group.color }} />
                      <div>
                        <h3>{group.name}</h3>
                        {group.description && <p className="group-description">{group.description}</p>}
                      </div>
                    </div>
                    <div className="group-actions">
                      <button
                        className="icon-button"
                        onClick={() => setSelectedGroupForRepos(selectedGroupForRepos === group.id ? null : group.id)}
                        title="Manage repositories"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-button delete"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="Delete group"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="group-repos-count">
                    {group.repoNames.length} {group.repoNames.length === 1 ? 'repository' : 'repositories'}
                  </div>

                  {selectedGroupForRepos === group.id && (
                    <div className="repos-selector">
                      <h4>Select Repositories for this Group:</h4>
                      <div className="repos-list">
                        {repositories.map(repo => (
                          <label key={repo.name} className="repo-checkbox">
                            <input
                              type="checkbox"
                              checked={group.repoNames.includes(repo.name)}
                              onChange={() => handleToggleRepo(group.id, repo.name)}
                            />
                            <span>{repo.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="close-footer-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectGroupsModal;
