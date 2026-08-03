import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Sidebar } from '../components/Sidebar';
import {
  FileText, Plus, Search, Users, Clock, FolderOpen, Star,
  Copy, Edit2, Trash2, Bell, Settings, MoreHorizontal, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my');
  const [documents, setDocuments] = useState({ my_documents: [], shared_with_me: [], recent_documents: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingDocId, setEditingDocId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/api/documents');
      setDocuments(res.data.data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/documents', { title: newTitle.trim() || 'Untitled Document' });
      setShowCreateModal(false);
      setNewTitle('');
      navigate(`/documents/${res.data.document.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create document');
    }
  };

  const handleDuplicate = async (docId, e) => {
    e.stopPropagation();
    try {
      await api.post(`/api/documents/${docId}/duplicate`);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to duplicate document');
    }
  };

  const handleDelete = async (docId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/api/documents/${docId}`);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const handleRenameSubmit = async (docId, e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    try {
      await api.put(`/api/documents/${docId}`, { title: editTitle.trim() });
      setEditingDocId(null);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to rename document');
    }
  };

  const handleToggleStar = async (docId, e) => {
    e.stopPropagation();
    try {
      await api.post(`/api/documents/${docId}/star`);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle star');
    }
  };

  const getDisplayedDocs = () => {
    let list = [];
    const allDocs = [...documents.my_documents, ...documents.shared_with_me];
    const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());

    if (activeTab === 'all') list = uniqueDocs;
    else if (activeTab === 'my' || activeTab === 'dashboard') list = documents.my_documents;
    else if (activeTab === 'shared') list = documents.shared_with_me;
    else if (activeTab === 'starred') list = uniqueDocs.filter(d => d.is_starred);
    else list = documents.recent_documents;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(d => d.title.toLowerCase().includes(q) || (d.owner_name && d.owner_name.toLowerCase().includes(q)));
    }
    return list;
  };

  const displayedDocs = getDisplayedDocs();

  // Stats
  const allDocs = [...documents.my_documents, ...documents.shared_with_me];
  const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
  const allCount = uniqueDocs.length;
  const myCount = documents.my_documents.length;
  const sharedCount = documents.shared_with_me.length;
  const recentCount = documents.recent_documents.length;
  const starredCount = uniqueDocs.filter(d => d.is_starred).length;

  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');

  const stats = [
    { id: 'all', label: 'All Documents', value: allCount, icon: FileText, color: 'bg-indigo-50 text-indigo-600' },
    { id: 'my', label: 'My Documents', value: myCount, icon: FolderOpen, color: 'bg-blue-50 text-blue-600' },
    { id: 'shared', label: 'Shared with Me', value: sharedCount, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { id: 'recent', label: 'Recently Opened', value: recentCount, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { id: 'starred', label: 'Starred', value: starredCount, icon: Star, color: 'bg-emerald-50 text-emerald-600' },
  ];

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    try {
      await api.put('/api/auth/me', { name: profileName.trim() });
      alert('Profile updated successfully!');
      setShowSettingsModal(false);
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewDocument={() => setShowCreateModal(true)}
        documents={documents.my_documents}
      />

      {/* Main Content */}
      <main className="flex-1 ml-[260px] min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center space-x-3 relative">
            <div
              onClick={() => setShowSettingsModal(!showSettingsModal)}
              className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold uppercase ring-2 ring-brand-200 cursor-pointer hover:opacity-90 transition shadow-sm"
              title="Profile & Settings"
            >
              {user?.name ? user.name[0] : 'U'}
            </div>
          </div>
        </header>

        <div className="px-8 py-6">
          {/* Greeting & Quick Action */}
          <div className="mb-8 animate-fadeIn flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-heading text-slate-900">
                {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}! 👋
              </h1>
              <p className="text-sm text-slate-500 mt-1">Here's what's happening with your documents.</p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-600/25 transition active:scale-95 flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span>New Document</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {stats.map((stat, i) => (
              <div
                key={i}
                onClick={() => setActiveTab(stat.id)}
                className={`stat-card animate-fadeIn cursor-pointer transition transform hover:-translate-y-0.5 hover:shadow-md ${activeTab === stat.id ? 'ring-2 ring-brand-500' : ''}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>


          {/* Recent Documents Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn" style={{ animationDelay: '300ms' }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading text-slate-900">
                {activeTab === 'shared' ? 'Shared Documents' : activeTab === 'recent' ? 'Recent Documents' : 'Recent Documents'}
              </h2>
              <button
                onClick={() => setActiveTab('recent')}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center space-x-1"
              >
                <span>View all documents</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Loading documents...</p>
              </div>
            ) : displayedDocs.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold font-heading text-slate-800 mb-1">No Documents Found</h3>
                <p className="text-slate-500 text-sm mb-6">
                  {searchQuery ? 'No documents match your search.' : 'Create your first document to get started.'}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 bg-brand-600 text-white font-medium text-sm rounded-lg hover:bg-brand-700 transition"
                >
                  Create Document
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">Title</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">Owner</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">Date Created</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">Last Modified</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition group"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              {editingDocId === doc.id ? (
                                <form onSubmit={(e) => handleRenameSubmit(doc.id, e)} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    autoFocus
                                    className="text-sm font-semibold text-slate-900 border-b-2 border-brand-600 focus:outline-none bg-transparent"
                                  />
                                </form>
                              ) : (
                                <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition">{doc.title}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm text-slate-600">{doc.owner_name || doc.owner_email || 'You'}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm text-slate-500">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm text-slate-500">{getRelativeTime(doc.updated_at)}</span>
                        </td>

                        <td className="px-6 py-3.5">
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleToggleStar(doc.id, e)}
                              className={`p-1.5 rounded-lg transition ${doc.is_starred ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'}`}
                              title={doc.is_starred ? "Unstar Document" : "Star Document"}
                            >
                              <Star className={`w-3.5 h-3.5 ${doc.is_starred ? 'fill-amber-500 text-amber-500' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => handleDuplicate(doc.id, e)}
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {['OWNER', 'EDITOR'].includes(doc.user_role) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingDocId(doc.id); setEditTitle(doc.title); }}
                                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition"
                                title="Rename"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {doc.user_role === 'OWNER' && (
                              <button
                                onClick={(e) => handleDelete(doc.id, e)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-md w-full animate-scaleIn">
            <h3 className="text-xl font-bold font-heading text-slate-900 mb-1">Create New Document</h3>
            <p className="text-sm text-slate-500 mb-5">Enter a title for your new collaborative document.</p>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Q4 Marketing Strategy"
                autoFocus
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <div className="flex items-center justify-end space-x-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-md transition"
                >
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-md w-full animate-scaleIn">
            <h3 className="text-xl font-bold font-heading text-slate-900 mb-1">User Profile & Settings</h3>
            <p className="text-sm text-slate-500 mb-5">Update your account settings and preferences.</p>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="text"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-slate-200 bg-slate-100 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-md transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

