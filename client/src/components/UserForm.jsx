import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const UserForm = ({ user, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'viewer'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        role: user.role || 'viewer'
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validar que si es nuevo usuario, tenga contraseña
    if (!user && !formData.password) {
      setError('La contraseña es requerida para nuevos usuarios');
      return;
    }

    setLoading(true);

    try {
      if (user) {
        // Actualizar usuario
        const updateData = {
          role: formData.role
        };
        
        // Solo actualizar username si cambió
        if (formData.username !== user.username) {
          updateData.username = formData.username;
        }
        
        // Solo actualizar password si se proporcionó
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        await api.put(`/users/${user.id}`, updateData);
      } else {
        // Crear nuevo usuario
        await api.post('/users', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre de Usuario *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>{user ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!user}
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label>Rol *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="viewer">Visualizador (solo ver y agregar)</option>
              <option value="editor">Editor (ver, agregar y editar)</option>
              <option value="technician">Técnico (solo ver instalaciones y folios)</option>
              <option value="admin">Administrador (acceso completo)</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;



