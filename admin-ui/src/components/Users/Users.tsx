import { useState, useEffect } from 'react';
import { usersAPI } from '../../services/api';
import { toast } from '../../utils/toast';
import './Users.css';

interface User {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    is_admin: false,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to load users';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await usersAPI.create(formData);
      toast.success('User created successfully');
      setShowForm(false);
      setFormData({ email: '', password: '', name: '', is_admin: false });
      loadUsers();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to create user';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAdmin = async (id: number, currentStatus: boolean) => {
    try {
      await usersAPI.updateAdmin(id, !currentStatus);
      toast.success(`User ${!currentStatus ? 'promoted to' : 'removed from'} admin`);
      loadUsers();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update user';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>Users</h1>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add User'}
          </button>
        </div>

        {loading && (
          <div className="loading">Loading users...</div>
        )}

        {error && !loading && (
          <div className="error-message">
            {error}
            <button onClick={loadUsers} className="btn btn-secondary">
              Retry
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_admin}
                  onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                />
                Admin
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </form>
        )}

        {!loading && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  {user.is_admin ? (
                    <span className="badge badge-success">Admin</span>
                  ) : (
                    <span className="badge badge-info">User</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => toggleAdmin(user.id, user.is_admin)}
                  >
                    {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
