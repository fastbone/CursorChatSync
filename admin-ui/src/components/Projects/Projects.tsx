import { useState, useEffect } from 'react';
import { projectsAPI } from '../../services/api';
import './Projects.css';

interface Project {
  id: number;
  git_repo_url: string;
  git_repo_name: string;
  owner_id: number;
  owner_name?: string;
  created_at: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>Projects</h1>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Repository Name</th>
              <th>Repository URL</th>
              <th>Owner</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.id}</td>
                <td>{project.git_repo_name}</td>
                <td>
                  <a href={project.git_repo_url} target="_blank" rel="noopener noreferrer">
                    {project.git_repo_url}
                  </a>
                </td>
                <td>{project.owner_name || `User ${project.owner_id}`}</td>
                <td>{new Date(project.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
