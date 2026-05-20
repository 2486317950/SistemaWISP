import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDateTime } from '../utils/dateUtils';
import './AppVersions.css';

const AppVersions = () => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [apkFile, setApkFile] = useState(null);
  const [message, setMessage] = useState(null);

  const loadVersions = () => {
    setLoading(true);
    api.get('/app-versions')
      .then((res) => setVersions(res.data || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apkFile) {
      setMessage({ error: 'Selecciona un archivo APK' });
      return;
    }
    if (!versionName.trim() || !versionCode.trim()) {
      setMessage({ error: 'Nombre y código de versión son requeridos' });
      return;
    }
    const vc = parseInt(versionCode, 10);
    if (isNaN(vc) || vc < 1) {
      setMessage({ error: 'El código de versión debe ser un número mayor a 0' });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setMessage(null);
    const formData = new FormData();
    formData.append('apk', apkFile);
    formData.append('version_name', versionName.trim());
    formData.append('version_code', vc);
    if (releaseNotes.trim()) formData.append('release_notes', releaseNotes.trim());

    try {
      const res = await api.post('/app-versions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        }
      });
      setMessage({ success: res.data?.message });
      setVersionName('');
      setVersionCode('');
      setReleaseNotes('');
      setApkFile(null);
      setUploadProgress(100);
      document.getElementById('apk-input')?.value && (document.getElementById('apk-input').value = '');
      loadVersions();
    } catch (err) {
      setMessage({ error: err.response?.data?.error || 'Error al subir' });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const handlePublish = async (id) => {
    try {
      await api.patch(`/app-versions/${id}/publish`);
      setMessage({ success: 'Versión publicada. Los clientes verán la actualización.' });
      loadVersions();
    } catch (err) {
      setMessage({ error: err.response?.data?.error || 'Error al publicar' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta versión de la app?')) return;
    try {
      await api.delete(`/app-versions/${id}`);
      loadVersions();
    } catch (err) {
      setMessage({ error: err.response?.data?.error || 'Error al eliminar' });
    }
  };

  return (
    <div className="app-versions-page">
      <div className="app-versions-header">
        <h1>📱 Versiones de la App del Cliente</h1>
        <p>Sube nuevas versiones del APK. Las versiones quedan en borrador hasta que las publiques.</p>
      </div>

      <div className="app-versions-container">
        <div className="app-versions-form-card">
          <h2>Subir nueva versión</h2>
          <form onSubmit={handleSubmit} className="app-version-form">
            {message?.error && <div className="app-version-error">{message.error}</div>}
            {message?.success && <div className="app-version-success">{message.success}</div>}

            <div className="form-row">
              <div className="form-group">
                <label>Nombre de versión *</label>
                <input
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="Ej: 1.2.0"
                  disabled={uploading}
                />
              </div>
              <div className="form-group">
                <label>Código de versión *</label>
                <input
                  type="number"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  placeholder="Ej: 2"
                  min="1"
                  disabled={uploading}
                />
                <small>Debe ser mayor que la versión actual en build.gradle (versionCode)</small>
              </div>
            </div>

            <div className="form-group">
              <label>Archivo APK *</label>
              <input
                id="apk-input"
                type="file"
                accept=".apk"
                onChange={(e) => setApkFile(e.target.files?.[0])}
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div className="form-group">
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="progress-text">{uploadProgress}%</span>
              </div>
            )}

            <div className="form-group">
              <label>Notas de la versión (opcional)</label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Cambios en esta versión..."
                rows={3}
                disabled={uploading}
              />
            </div>

            <button type="submit" className="btn-upload" disabled={uploading}>
              {uploading ? 'Subiendo...' : '📤 Subir versión'}
            </button>
          </form>
        </div>

        <div className="app-versions-list-card">
          <h2>Versiones</h2>
          {loading ? (
            <p>Cargando...</p>
          ) : versions.length === 0 ? (
            <p className="empty-msg">No hay versiones subidas aún.</p>
          ) : (
            <div className="versions-list">
              {versions.map((v) => (
                <div key={v.id} className={`version-item ${v.published ? 'version-published' : 'version-draft'}`}>
                  <div className="version-info">
                    <div className="version-header-row">
                      <strong>{v.version_name}</strong>
                      <span className={`version-badge ${v.published ? 'badge-published' : 'badge-draft'}`}>
                        {v.published ? 'Publicada' : 'Borrador'}
                      </span>
                    </div>
                    <span className="version-code">Código: {v.version_code}</span>
                    {v.release_notes && <span className="version-notes">{v.release_notes}</span>}
                    <span className="version-date">{formatLocalDateTime(v.created_at)}</span>
                  </div>
                  <div className="version-actions">
                    {!v.published && (
                      <button
                        type="button"
                        className="btn-publish-version"
                        onClick={() => handlePublish(v.id)}
                        title="Publicar"
                      >
                        📢 Publicar
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-delete-version"
                      onClick={() => handleDelete(v.id)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="app-versions-info">
        <h3>ℹ️ Cómo funciona</h3>
        <ul>
          <li>Sube el APK y quedará en <strong>borrador</strong>. Los clientes no lo verán hasta que lo publiques.</li>
          <li>Cuando publiques una versión, los clientes que abran la app verán la actualización disponible.</li>
          <li>Puedes ver la versión de la app de cada cliente en su ficha (Clientes → [cliente] → Portal del Cliente).</li>
        </ul>
      </div>
    </div>
  );
};

export default AppVersions;
