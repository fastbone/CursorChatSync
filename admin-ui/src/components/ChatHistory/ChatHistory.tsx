import { useState, useEffect } from 'react';
import { chatAPI } from '../../services/api';
import { projectsAPI } from '../../services/api';
import './ChatHistory.css';

interface ChatHistoryItem {
  id: number;
  project_id: number;
  user_id: number;
  chat_data: any;
  last_synced_at: string;
  workstation_id?: string;
  created_at: string;
  git_repo_name?: string;
  user_name?: string;
}

interface Project {
  id: number;
  git_repo_name: string;
  git_repo_url: string;
}

export default function ChatHistory() {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.data);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await chatAPI.getHistory(selectedProject);
      setHistory(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load chat history');
      console.error('Failed to load chat history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatChatData = (chatData: any): string => {
    if (!chatData) return 'No data';
    
    if (typeof chatData === 'string') {
      try {
        chatData = JSON.parse(chatData);
      } catch {
        return chatData;
      }
    }

    if (typeof chatData === 'object') {
      // Try to extract meaningful chat information
      const keys = Object.keys(chatData);
      if (keys.length === 0) return 'Empty data';
      
      // Look for conversation or chat keys
      const conversationKeys = keys.filter(k => 
        k.toLowerCase().includes('chat') || 
        k.toLowerCase().includes('conversation') ||
        k.toLowerCase().includes('message')
      );

      if (conversationKeys.length > 0) {
        return `${conversationKeys.length} conversation key(s) found`;
      }

      return `${keys.length} key(s): ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`;
    }

    return String(chatData);
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading && history.length === 0) {
    return (
      <div className="chat-history">
        <div className="loading">Loading chat history...</div>
      </div>
    );
  }

  return (
    <div className="chat-history">
      <div className="chat-history-header">
        <h1>Chat History</h1>
        <div className="filters">
          <select
            value={selectedProject || ''}
            onChange={(e) => setSelectedProject(e.target.value ? parseInt(e.target.value) : undefined)}
            className="filter-select"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.git_repo_name}
              </option>
            ))}
          </select>
          <button onClick={loadHistory} className="btn btn-primary">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadHistory} className="btn btn-secondary">
            Retry
          </button>
        </div>
      )}

      {!loading && history.length === 0 && (
        <div className="empty-state">
          <p>No chat history found.</p>
        </div>
      )}

      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-item-header" onClick={() => toggleExpand(item.id)}>
              <div className="history-item-info">
                <h3>{item.git_repo_name || `Project ${item.project_id}`}</h3>
                <div className="history-item-meta">
                  <span>User: {item.user_name || `User ${item.user_id}`}</span>
                  <span>Synced: {formatDate(item.last_synced_at)}</span>
                  {item.workstation_id && <span>Workstation: {item.workstation_id}</span>}
                </div>
              </div>
              <button className="expand-btn">
                {expandedId === item.id ? '▼' : '▶'}
              </button>
            </div>
            {expandedId === item.id && (
              <div className="history-item-content">
                <div className="chat-data-preview">
                  <strong>Chat Data Preview:</strong>
                  <pre>{formatChatData(item.chat_data)}</pre>
                </div>
                <div className="chat-data-full">
                  <strong>Full Data (JSON):</strong>
                  <pre>{JSON.stringify(item.chat_data, null, 2)}</pre>
                </div>
                <div className="history-item-details">
                  <p><strong>ID:</strong> {item.id}</p>
                  <p><strong>Created:</strong> {formatDate(item.created_at)}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
