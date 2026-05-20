import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import UserForm from '../components/UserForm';
import { useToast } from '../context/ToastContext';
import './Users.css';

const Users = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar el usuario');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  };

  if (!isAdmin) {
    return (
      <div className="access-denied">
        <h2>Acceso Denegado</h2>
        <p>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Cargando usuarios...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar Usuario
        </button>
      </div>

      {showForm && (
        <UserForm
          user={editingUser}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Fecha de Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role === 'admin' ? 'Administrador' : 
                     user.role === 'editor' ? 'Editor' : 'Visualizador'}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-icon"
                      onClick={() => {
                        setEditingUser(user);
                        setShowForm(true);
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(user.id)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="empty-state">
          <p>No hay usuarios registrados</p>
        </div>
      )}
    </div>
  );
};

export default Users;



