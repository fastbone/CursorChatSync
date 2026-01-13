import pool from '../db/connection';
import { Project, CreateProjectInput, ProjectResponse } from '../models/Project';

export class ProjectService {
  async createProject(input: CreateProjectInput): Promise<Project> {
    const result = await pool.query(
      `INSERT INTO projects (git_repo_url, git_repo_name, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.git_repo_url, input.git_repo_name, input.owner_id]
    );
    
    return this.mapToProject(result.rows[0]);
  }
  
  async getProjectById(id: number): Promise<Project | null> {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapToProject(result.rows[0]);
  }
  
  async getProjectByRepoUrl(repoUrl: string, ownerId: number): Promise<Project | null> {
    const result = await pool.query(
      'SELECT * FROM projects WHERE git_repo_url = $1 AND owner_id = $2',
      [repoUrl, ownerId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapToProject(result.rows[0]);
  }
  
  async getProjectsByOwner(ownerId: number): Promise<ProjectResponse[]> {
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.owner_id = $1
       ORDER BY p.created_at DESC`,
      [ownerId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      git_repo_url: row.git_repo_url,
      git_repo_name: row.git_repo_name,
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      created_at: row.created_at,
    }));
  }
  
  async getAllProjects(): Promise<ProjectResponse[]> {
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_at DESC`
    );
    
    return result.rows.map(row => ({
      id: row.id,
      git_repo_url: row.git_repo_url,
      git_repo_name: row.git_repo_name,
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      created_at: row.created_at,
    }));
  }
  
  async findOrCreateProject(repoUrl: string, repoName: string, ownerId: number): Promise<Project> {
    let project = await this.getProjectByRepoUrl(repoUrl, ownerId);
    
    if (!project) {
      project = await this.createProject({
        git_repo_url: repoUrl,
        git_repo_name: repoName,
        owner_id: ownerId,
      });
    }
    
    return project;
  }
  
  private mapToProject(row: any): Project {
    return {
      id: row.id,
      git_repo_url: row.git_repo_url,
      git_repo_name: row.git_repo_name,
      owner_id: row.owner_id,
      created_at: row.created_at,
    };
  }
}

export default new ProjectService();
