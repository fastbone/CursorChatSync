import { useState, useEffect } from 'react';
import { permissionsAPI } from '../../services/api';
import './Permissions.css';

interface Permission {
  id: number;
  project_id: number;
  project_name?: string;
  requester_id: number;
  requester_name?: string;
  approver_id?: number;
  approver_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export default function Permissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');

  useEffect(() => {
    loadPermissions();
  }, [filter]);

  const loadPermissions = async () => {
    try {
      const response =
        filter === 'pending'
          ? await permissionsAPI.getPending()
          : await permissionsAPI.getAll();
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await permissionsAPI.approve(id);
      loadPermissions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve permission');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await permissionsAPI.reject(id);
      loadPermissions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject permission');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="badge badge-success">Approved</span>;
      case 'rejected':
        return <span className="badge badge-danger">Rejected</span>;
      default:
        return <span className="badge badge-warning">Pending</span>;
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>Permissions</h1>
          <div>
            <button
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
              style={{ marginLeft: '8px' }}
            >
              All
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Project</th>
              <th>Requester</th>
              <th>Status</th>
              <th>Approver</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td>{permission.id}</td>
                <td>{permission.project_name || `Project ${permission.project_id}`}</td>
                <td>{permission.requester_name || `User ${permission.requester_id}`}</td>
                <td>{getStatusBadge(permission.status)}</td>
                <td>{permission.approver_name || '-'}</td>
                <td>{new Date(permission.created_at).toLocaleDateString()}</td>
                <td>
                  {permission.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-success"
                        onClick={() => handleApprove(permission.id)}
                        style={{ marginRight: '8px' }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReject(permission.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
