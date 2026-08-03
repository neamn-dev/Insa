import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History, Plus, RotateCcw, Clock, X, User, Check, Eye } from 'lucide-react';

export const VersionHistoryPanel = ({ documentId, userRole, activePreviewVersion, onSelectVersion, onVersionRestored, onClose }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(activePreviewVersion || null);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  const canCreateOrRestore = ['OWNER', 'EDITOR'].includes(userRole);

  const fetchVersions = async () => {
    try {
      const res = await api.get(`/api/documents/${documentId}/versions`);
      const vers = res.data.versions || [];
      setVersions(vers);
      if (vers.length > 0 && !activePreviewVersion) {
        setSelectedVersion(vers[0]); // Select latest by default
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  useEffect(() => {
    if (activePreviewVersion) {
      setSelectedVersion(activePreviewVersion);
    }
  }, [activePreviewVersion]);

  const handleVersionClick = (ver) => {
    setSelectedVersion(ver);
    if (onSelectVersion) {
      onSelectVersion(ver);
    }
  };

  const handleCreateCheckpoint = async () => {
    try {
      await api.post(`/api/documents/${documentId}/versions`, { version_type: 'MANUAL' });
      fetchVersions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create checkpoint');
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!confirm('Restoring this version will set the document content to this snapshot and create a new version checkpoint. Continue?')) return;
    setRestoringId(versionId);
    try {
      const res = await api.post(`/api/documents/${documentId}/versions/${versionId}/restore`);
      const restoredContent = res.data?.data?.state_data || '';
      fetchVersions();
      if (onVersionRestored) {
        onVersionRestored(restoredContent);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <aside className="w-96 bg-white border-l border-slate-200 h-full flex flex-col shadow-xl z-30 animate-slideInLeft">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-brand-600" />
          <h3 className="font-bold font-heading text-slate-900 text-base">Version History</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Version Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {canCreateOrRestore && (
          <button
            onClick={handleCreateCheckpoint}
            className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs rounded-lg transition border border-brand-200 mb-3"
          >
            <Plus className="w-4 h-4" />
            <span>Create Version Checkpoint</span>
          </button>
        )}

        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Loading version history...</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No version checkpoints recorded.</p>
        ) : (
          versions.map((ver, index) => {
            const isLatest = index === 0;
            const isSelected = selectedVersion?.id === ver.id;

            return (
              <div
                key={ver.id}
                onClick={() => handleVersionClick(ver)}
                className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                  isSelected ? 'bg-brand-50/50 border-brand-300 ring-1 ring-brand-300 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900">
                      Version {ver.version_number}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 uppercase">
                        Current
                      </span>
                    )}
                    {ver.version_type && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {ver.version_type}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>{ver.created_at ? new Date(ver.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}</p>
                  <p className="text-slate-400 font-medium">By {ver.creator_name || 'System'}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Version Action */}
      {selectedVersion && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <p className="font-bold text-slate-900 mb-0.5">Version #{selectedVersion.version_number} Selected</p>
            <p className="text-[11px] text-slate-500">
              Clicking a version loads its full snapshot into the main editor canvas.
            </p>
          </div>

          {canCreateOrRestore && (
            <button
              onClick={() => handleRestoreVersion(selectedVersion.id)}
              disabled={restoringId === selectedVersion.id}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{restoringId === selectedVersion.id ? 'Restoring...' : 'Restore this version'}</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
