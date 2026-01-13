import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; is_admin?: boolean }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data: { email: string; password: string; name: string; is_admin?: boolean }) =>
    api.post('/users', data),
  updateAdmin: (id: number, is_admin: boolean) =>
    api.put(`/users/${id}/admin`, { is_admin }),
};

export const projectsAPI = {
  getAll: () => api.get('/projects'),
  getById: (id: number) => api.get(`/projects/${id}`),
  create: (data: { git_repo_url: string; git_repo_name: string }) =>
    api.post('/projects', data),
};

export const permissionsAPI = {
  getAll: () => api.get('/permissions'),
  getPending: () => api.get('/permissions/pending'),
  approve: (id: number) => api.post(`/permissions/${id}/approve`),
  reject: (id: number) => api.post(`/permissions/${id}/reject`),
};

export const teamsAPI = {
  getAll: () => api.get('/teams'),
  create: (data: { name: string }) => api.post('/teams', data),
  addMember: (teamId: number, data: { user_id: number; role?: string }) =>
    api.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId: number, userId: number) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
};

export const chatAPI = {
  getHistory: (projectId?: number) => {
    const params = projectId ? { project_id: projectId } : {};
    return api.get('/chat/history', { params });
  },
};

export default api;
