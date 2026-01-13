import pool from '../db/connection';
import { Permission, CreatePermissionInput, PermissionResponse } from '../models/Permission';
import projectService from './projectService';
import { logger } from '../utils/logger';

export class PermissionService {
  async canUserSyncProject(userId: number, projectId: number): Promise<boolean> {
    const project = await projectService.getProjectById(projectId);
    
    if (!project) {
      return false;
    }
    
    // User can always sync their own projects
    if (project.owner_id === userId) {
      return true;
    }
    
    // Check if there's an approved permission
    const result = await pool.query(
      `SELECT status FROM permissions
       WHERE project_id = $1 AND requester_id = $2 AND status = 'approved'`,
      [projectId, userId]
    );
    
    return result.rows.length > 0;
  }
  
  async requestPermission(input: CreatePermissionInput): Promise<Permission> {
    // Check if permission already exists
    const existing = await pool.query(
      'SELECT * FROM permissions WHERE project_id = $1 AND requester_id = $2',
      [input.project_id, input.requester_id]
    );
    
    if (existing.rows.length > 0) {
      return this.mapToPermission(existing.rows[0]);
    }
    
    // Create new permission request
    const result = await pool.query(
      `INSERT INTO permissions (project_id, requester_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [input.project_id, input.requester_id]
    );
    
    return this.mapToPermission(result.rows[0]);
  }
  
  async approvePermission(permissionId: number, approverId: number): Promise<Permission> {
    const result = await pool.query(
      `UPDATE permissions
       SET status = 'approved', approver_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [approverId, permissionId]
    );
    
    if (result.rows.length === 0) {
      logger.error('Permission not found for approval', undefined, { permissionId, approverId });
      throw new Error('Permission not found');
    }
    
    const permission = this.mapToPermission(result.rows[0]);
    logger.logPermission('approved', permissionId, approverId, permission.project_id);
    return permission;
  }
  
  async rejectPermission(permissionId: number, approverId: number): Promise<Permission> {
    const result = await pool.query(
      `UPDATE permissions
       SET status = 'rejected', approver_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [approverId, permissionId]
    );
    
    if (result.rows.length === 0) {
      logger.error('Permission not found for rejection', undefined, { permissionId, approverId });
      throw new Error('Permission not found');
    }
    
    const permission = this.mapToPermission(result.rows[0]);
    logger.logPermission('rejected', permissionId, approverId, permission.project_id);
    return permission;
  }
  
  async getPendingPermissions(): Promise<PermissionResponse[]> {
    const result = await pool.query(
      `SELECT p.*, pr.git_repo_name as project_name,
              u1.name as requester_name, u2.name as approver_name
       FROM permissions p
       JOIN projects pr ON p.project_id = pr.id
       JOIN users u1 ON p.requester_id = u1.id
       LEFT JOIN users u2 ON p.approver_id = u2.id
       WHERE p.status = 'pending'
       ORDER BY p.created_at DESC`
    );
    
    return result.rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      project_name: row.project_name,
      requester_id: row.requester_id,
      requester_name: row.requester_name,
      approver_id: row.approver_id,
      approver_name: row.approver_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }
  
  async getAllPermissions(): Promise<PermissionResponse[]> {
    const result = await pool.query(
      `SELECT p.*, pr.git_repo_name as project_name,
              u1.name as requester_name, u2.name as approver_name
       FROM permissions p
       JOIN projects pr ON p.project_id = pr.id
       JOIN users u1 ON p.requester_id = u1.id
       LEFT JOIN users u2 ON p.approver_id = u2.id
       ORDER BY p.created_at DESC`
    );
    
    return result.rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      project_name: row.project_name,
      requester_id: row.requester_id,
      requester_name: row.requester_name,
      approver_id: row.approver_id,
      approver_name: row.approver_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }
  
  private mapToPermission(row: any): Permission {
    return {
      id: row.id,
      project_id: row.project_id,
      requester_id: row.requester_id,
      approver_id: row.approver_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export default new PermissionService();
