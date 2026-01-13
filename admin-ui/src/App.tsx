import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Users from './components/Users/Users';
import Projects from './components/Projects/Projects';
import Permissions from './components/Permissions/Permissions';
import Teams from './components/Teams/Teams';
import ChatHistory from './components/ChatHistory/ChatHistory';
import { ToastContainer } from './utils/toast';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout onLogout={() => setIsAuthenticated(false)} />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={<Navigate to="/users" />} />
          <Route path="users" element={<Users />} />
          <Route path="projects" element={<Projects />} />
          <Route path="permissions" element={<Permissions />} />
          <Route path="teams" element={<Teams />} />
          <Route path="chat-history" element={<ChatHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
