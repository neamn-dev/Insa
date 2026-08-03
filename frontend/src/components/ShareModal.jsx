import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Share2, UserPlus, Trash2, X, Shield, Search } from 'lucide-react';

export const ShareModal = ({ documentId, onClose }) => {
  const [shares, setShares] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('VIEWER');
  const [loading, setLoading] = useState(true);

  const fetchShares = async () => {
    try {
      const res = await api.get(`/api/documents/${documentId}/shares`);
      setShares(res.data.shares || []);
    } catch (err) {
      console.error('Failed to fetch shares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [documentId]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      api.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
        .then((res) => setSearchResults(res.data.users || []))
        .catch(() => setSearchResults([]));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleAddShare = async (e) => {
    e.preventDefault();
    const emailToShare = selectedEmail || searchQuery;
    if (!emailToShare.trim()) return;

    try {
      await api.post(`/api/documents/${documentId}/shares`, {
        email: emailToShare.trim(),
        role: selectedRole
      });
      setSearchQuery('');
      setSelectedEmail('');
      setSearchResults([]);
      fetchShares();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to share document');
    }
  };

  const handleRemoveShare = async (userId) => {
    try {
      await api.delete(`/api/documents/${documentId}/shares/${userId}`);
      fetchShares();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove share');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-scaleIn">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-lg">Share Document</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={handleAddShare} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Add Collaborator
            </label>
            <div className="relative">
              <input
                type="email"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedEmail(e.target.value); }}
                placeholder="Enter user email..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSearchQuery(u.email); setSelectedEmail(u.email); setSearchResults([]); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 flex items-center justify-between border-b border-slate-100 last:border-none"
                    >
                      <span className="font-medium text-slate-800">{u.name}</span>
                      <span className="text-slate-500">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="VIEWER">Viewer (Read-only)</option>
                <option value="COMMENTER">Commenter (Read & Comment)</option>
                <option value="EDITOR">Editor (Full Edit Access)</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-md transition flex items-center space-x-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </form>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Collaborators with Access
            </label>

            {loading ? (
              <p className="text-xs text-slate-400 py-2">Loading shares...</p>
            ) : shares.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No collaborators shared yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{share.user_name || share.user_email}</p>
                      <p className="text-[11px] text-slate-500">{share.user_email}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-700 uppercase">
                        {share.role}
                      </span>
                      <button
                        onClick={() => handleRemoveShare(share.user_id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                        title="Remove Access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
