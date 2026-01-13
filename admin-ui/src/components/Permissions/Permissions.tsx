import { useState, useEffect, useRef } from 'react';
import { permissionsAPI } from '../../services/api';
import { toast } from '../../utils/toast';
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
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const previousPendingCount = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPermissions();
    
    // Start polling for updates
    if (pollingEnabled) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [filter, pollingEnabled]);

  const startPolling = () => {
    stopPolling(); // Clear any existing interval
    pollingIntervalRef.current = setInterval(() => {
      loadPermissions(true); // Silent refresh
    }, 5000); // Poll every 5 seconds
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const loadPermissions = async (silent: boolean = false) => {
    try {
      const response =
        filter === 'pending'
          ? await permissionsAPI.getPending()
          : await permissionsAPI.getAll();
      
      const newPermissions = response.data;
      
      // Check for new pending requests
      if (filter === 'pending' && !silent) {
        const currentPendingCount = newPermissions.filter(p => p.status === 'pending').length;
        if (currentPendingCount > previousPendingCount.current && previousPendingCount.current > 0) {
          const newCount = currentPendingCount - previousPendingCount.current;
          toast.info(`New permission request${newCount > 1 ? 's' : ''} received!`);
        }
        previousPendingCount.current = currentPendingCount;
      }
      
      setPermissions(newPermissions);
    } catch (error: any) {
      if (!silent) {
        toast.error(error.response?.data?.error || 'Failed to load permissions');
      }
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await permissionsAPI.approve(id);
      toast.success('Permission approved successfully');
      loadPermissions(false); // Refresh with notification check
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve permission');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await permissionsAPI.reject(id);
      toast.success('Permission rejected');
      loadPermissions(false); // Refresh with notification check
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject permission');
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

  if (loading && permissions.length === 0) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading">Loading permissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>Permissions</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`btn ${pollingEnabled ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => {
                setPollingEnabled(!pollingEnabled);
                if (!pollingEnabled) {
                  startPolling();
                } else {
                  stopPolling();
                }
              }}
              title={pollingEnabled ? 'Auto-refresh enabled (every 5s)' : 'Auto-refresh disabled'}
            >
              {pollingEnabled ? '🔄 Auto' : '⏸ Paused'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => loadPermissions(false)}
              title="Refresh now"
            >
              ↻ Refresh
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
        {permissions.length === 0 && (
          <div className="empty-state">
            <p>No permissions found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
