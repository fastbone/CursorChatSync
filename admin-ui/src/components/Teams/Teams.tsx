import { useState, useEffect } from 'react';
import { teamsAPI, usersAPI } from '../../services/api';
import './Teams.css';

interface Team {
  id: number;
  name: string;
  members?: Array<{
    user_id: number;
    user_name: string;
    role: string;
  }>;
  created_at: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [newMember, setNewMember] = useState({ user_id: 0, role: 'member' });

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await teamsAPI.getAll();
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamsAPI.create({ name: teamName });
      setTeamName('');
      setShowForm(false);
      loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create team');
    }
  };

  const handleAddMember = async (teamId: number) => {
    try {
      await teamsAPI.addMember(teamId, newMember);
      setNewMember({ user_id: 0, role: 'member' });
      setSelectedTeam(null);
      loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number) => {
    try {
      await teamsAPI.removeMember(teamId, userId);
      loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove member');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>Teams</h1>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Create Team'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateTeam} className="team-form">
            <div className="form-group">
              <label>Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </form>
        )}

        <div className="teams-list">
          {teams.map((team) => (
            <div key={team.id} className="team-card">
              <h3>{team.name}</h3>
              <div className="members">
                <h4>Members</h4>
                {team.members && team.members.length > 0 ? (
                  <ul>
                    {team.members.map((member) => (
                      <li key={member.user_id}>
                        {member.user_name} ({member.role})
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRemoveMember(team.id, member.user_id)}
                          style={{ marginLeft: '8px' }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No members</p>
                )}
                {selectedTeam === team.id ? (
                  <div className="add-member-form">
                    <select
                      value={newMember.user_id}
                      onChange={(e) =>
                        setNewMember({ ...newMember, user_id: parseInt(e.target.value) })
                      }
                    >
                      <option value={0}>Select user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                    <select
                      value={newMember.role}
                      onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    >
                      <option value="member">Member</option>
                      <option value="lead">Lead</option>
                    </select>
                    <button
                      className="btn btn-success"
                      onClick={() => handleAddMember(team.id)}
                      disabled={newMember.user_id === 0}
                    >
                      Add
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedTeam(null);
                        setNewMember({ user_id: 0, role: 'member' });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setSelectedTeam(team.id)}
                  >
                    Add Member
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
