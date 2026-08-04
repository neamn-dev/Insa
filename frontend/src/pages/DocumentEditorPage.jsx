import React, { useState, useEffect, Component } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DocumentEditor } from '../components/DocumentEditor';
import { PresenceList } from '../components/PresenceList';
import { SaveStatus } from '../components/SaveStatus';
import { CommentsPanel } from '../components/CommentsPanel';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';
import { ShareModal } from '../components/ShareModal';
import {
  ArrowLeft, Share2, History, MessageSquare, Edit2, ShieldAlert,
  FileText, MoreHorizontal, Users, UserPlus, Clock, Eye, RotateCcw, Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';

class DocumentErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[DocumentEditorPage] Render crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl max-w-md w-full text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900 mb-1">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-4">{this.state.error?.message || 'An unexpected error occurred while loading the editor.'}</p>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AVATAR_COLORS = [
  'bg-yellow-500', 'bg-brand-500', 'bg-cyan-500',
  'bg-rose-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500'
];

const DocumentEditorPageInner = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  const [documentData, setDocumentData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [saveStatus, setSaveStatus] = useState('saved');
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [previewVersion, setPreviewVersion] = useState(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showPeopleSidebar, setShowPeopleSidebar] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const fetchDocument = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/documents/${id}`);
      const doc = res.data?.document;
      if (!doc) {
        console.error('[DocumentEditor] API returned success but no document data:', res.data);
        setError('Document data missing from server response.');
        return;
      }
      setDocumentData(doc);
      setUserRole(doc.user_role);
      setTitleInput(doc.title || 'Untitled Document');
    } catch (err) {
      console.error('[DocumentEditor] Fetch document error:', err);
      if (err.response?.status === 404 || err.response?.data?.message?.includes('not found')) {
        setError('Document not found.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to access this document.');
      } else if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load document.');
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  };


  useEffect(() => {
    fetchDocument(true);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket(accessToken);

    const handleShareUpdated = (data) => {
      if (data && data.document_id === id) {
        fetchDocument(false);
      }
    };

    const handleTitleUpdated = (data) => {
      if (data && data.document_id === id && data.title) {
        setDocumentData((prev) => prev ? { ...prev, title: data.title } : prev);
        setTitleInput(data.title);
      }
    };

    socket.on('document:share_updated', handleShareUpdated);
    socket.on('document:title_updated', handleTitleUpdated);

    return () => {
      socket.off('document:share_updated', handleShareUpdated);
      socket.off('document:title_updated', handleTitleUpdated);
    };
  }, [id, accessToken]);

  const handleTitleSubmit = async (e) => {
    e.preventDefault();
    if (!titleInput.trim() || titleInput === documentData.title) {
      setEditingTitle(false);
      return;
    }

    try {
      const res = await api.put(`/api/documents/${id}`, { title: titleInput.trim() });
      setDocumentData(res.data.document);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update title.');
    } finally {
      setEditingTitle(false);
    }
  };

  const handleTypingChange = (data) => {
    if (data.is_typing) {
      setTypingUsers((prev) => Array.from(new Set([...prev, data.name])));
    } else {
      setTypingUsers((prev) => prev.filter((name) => name !== data.name));
    }
  };

  const handleRestorePreviewVersion = async () => {
    if (!previewVersion) return;
    if (!confirm(`Restore Version #${previewVersion.version_number}? This will update the document for all collaborators.`)) return;
    try {
      await api.post(`/api/documents/${id}/versions/${previewVersion.id}/restore`);
      setPreviewVersion(null);
      fetchDocument();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to restore version');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Opening document...</p>
        </div>
      </div>
    );
  }

  if (error || !documentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl max-w-md w-full text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold font-heading text-slate-900 mb-1">Cannot Open Document</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Document not found or inaccessible.'}</p>
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={() => fetchDocument()}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 transition border border-slate-200"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-brand-600 text-white font-semibold text-sm rounded-lg hover:bg-brand-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Top Bar — Document Title & Actions */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-40">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              {editingTitle && ['OWNER', 'EDITOR'].includes(userRole) ? (
                <form onSubmit={handleTitleSubmit} className="flex items-center">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={handleTitleSubmit}
                    autoFocus
                    className="text-base font-bold font-heading text-slate-900 border-b-2 border-brand-600 focus:outline-none bg-transparent"
                  />
                </form>
              ) : (
                <button
                  onClick={() => ['OWNER', 'EDITOR'].includes(userRole) && setEditingTitle(true)}
                  className="group flex items-center space-x-1.5 text-base font-bold font-heading text-slate-900 hover:text-brand-600 text-left"
                >
                  <span className="truncate max-w-xs sm:max-w-md">{documentData?.title || 'Untitled Document'}</span>
                  {['OWNER', 'EDITOR'].includes(userRole) && (
                    <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400" />
                  )}
                </button>
              )}

              <SaveStatus status={saveStatus} />
            </div>
          </div>
        </div>


        {/* Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Presence Avatars */}
          <div className="hidden sm:block">
            <PresenceList activeUsers={activeUsers} typingUsers={typingUsers} />
          </div>

          <button
            onClick={async () => {
              try {
                const res = await api.post('/api/documents', { title: 'Untitled Document' });
                navigate(`/documents/${res.data.document.id}`);
              } catch (err) {
                alert(err.response?.data?.message || 'Failed to create document');
              }
            }}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs rounded-lg transition border border-brand-200"
            title="Create Blank Document"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">New Document</span>
          </button>

          {userRole === 'OWNER' && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md shadow-brand-600/25 transition"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          <button
            onClick={() => { setShowCommentsPanel(!showCommentsPanel); setShowVersionPanel(false); setShowPeopleSidebar(false); }}
            className={`p-1.5 sm:p-2 rounded-lg border transition ${showCommentsPanel ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            title="Comments"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => { setShowVersionPanel(!showVersionPanel); setShowCommentsPanel(false); setShowPeopleSidebar(false); }}
            className={`p-1.5 sm:p-2 rounded-lg border transition ${showVersionPanel ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            title="Version History"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={() => { setShowPeopleSidebar(!showPeopleSidebar); setShowCommentsPanel(false); setShowVersionPanel(false); }}
            className={`p-1.5 sm:p-2 rounded-lg border transition lg:hidden ${showPeopleSidebar ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            title="Document & Collaborators Info"
          >
            <Users className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              title="More Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
                <div className="px-3.5 py-2 border-b border-slate-100 text-slate-500">
                  <p className="font-semibold text-slate-800 truncate">{documentData.title}</p>
                  <p className="mt-0.5 text-[10px]">Owner: {documentData.owner_name || 'You'}</p>
                  <p className="text-[10px]">Created: {new Date(documentData.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={async () => {
                    setShowMoreMenu(false);
                    try {
                      const res = await api.post(`/api/documents/${id}/duplicate`);
                      navigate(`/documents/${res.data.document.id}`);
                    } catch (err) {
                      alert(err.response?.data?.message || 'Failed to duplicate document.');
                    }
                  }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700"
                >
                  Duplicate Document
                </button>
                <button
                  onClick={() => { setShowMoreMenu(false); window.print(); }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700"
                >
                  Print / Save as PDF
                </button>
                {userRole === 'OWNER' && (
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to delete this document?')) return;
                      setShowMoreMenu(false);
                      try {
                        await api.delete(`/api/documents/${id}`);
                        navigate('/dashboard');
                      } catch (err) {
                        alert(err.response?.data?.message || 'Failed to delete document.');
                      }
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-red-600 font-medium border-t border-slate-100"
                  >
                    Delete Document
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Version Preview Banner */}
      {previewVersion && (
        <div className="bg-amber-500 text-white px-6 py-2.5 flex items-center justify-between shadow-md z-30 animate-fadeIn">
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <Eye className="w-4 h-4 text-amber-100 animate-pulse flex-shrink-0" />
            <span>
              Previewing Version #{previewVersion.version_number} from {previewVersion.created_at ? new Date(previewVersion.created_at).toLocaleString() : ''} ({previewVersion.creator_name || 'System'}) — [Read-Only Preview]
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {['OWNER', 'EDITOR'].includes(userRole) && (
              <button
                onClick={handleRestorePreviewVersion}
                className="px-3.5 py-1 bg-white text-amber-900 font-bold text-xs rounded-lg hover:bg-amber-100 transition shadow-sm flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore this Version</span>
              </button>
            )}
            <button
              onClick={() => setPreviewVersion(null)}
              className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition"
            >
              Exit Preview
            </button>
          </div>
        </div>
      )}

      {/* Editor & Side Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DocumentEditor
            documentId={id}
            initialStateData={previewVersion ? previewVersion.snapshot_data : documentData.state_data}
            userRole={previewVersion ? 'VIEWER' : userRole}
            onSaveStatusChange={setSaveStatus}
            onPresenceChange={setActiveUsers}
            onTypingChange={handleTypingChange}
          />

          {/* Bottom Status Bar */}
          <footer className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center space-x-6">
              <span>Page 1 of 4</span>
              <span>Words: 1,243</span>
              <span>English (US)</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <button className="hover:text-slate-800 transition">-</button>
                <span>100%</span>
                <button className="hover:text-slate-800 transition">+</button>
              </div>
              <button
                onClick={() => alert('SyncWrite Help & Documentation')}
                className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[11px] transition"
              >
                ?
              </button>
            </div>
          </footer>
        </div>

        {/* Right Sidebar — Collaborators / Comments / Versions */}
        {showCommentsPanel ? (
          <CommentsPanel
            documentId={id}
            userRole={userRole}
            onClose={() => setShowCommentsPanel(false)}
          />
        ) : showVersionPanel ? (
          <VersionHistoryPanel
            documentId={id}
            userRole={userRole}
            activePreviewVersion={previewVersion}
            onSelectVersion={(ver) => setPreviewVersion(ver)}
            onVersionRestored={() => {
              setPreviewVersion(null);
              fetchDocument();
            }}
            onClose={() => setShowVersionPanel(false)}
          />
        ) : (
          <>
            {showPeopleSidebar && (
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 lg:hidden"
                onClick={() => setShowPeopleSidebar(false)}
              />
            )}
            <aside className={`w-full sm:w-80 bg-white border-l border-slate-200 flex-col h-full overflow-hidden shadow-2xl lg:shadow-sm ${showPeopleSidebar ? 'fixed inset-y-0 right-0 flex z-40 animate-slideInLeft' : 'hidden lg:flex'}`}>
            {/* Top Section — Collaborators */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Active Collaborators ({activeUsers.length > 0 ? activeUsers.length : 1})
              </h3>

              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {/* Current User */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                      {user?.name ? user.name[0] : 'U'}
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      {user?.name || 'You'} <span className="font-normal text-slate-400">(You)</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
                    <span>Active</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                </div>

                {/* Other Online Users */}
                {activeUsers
                  .filter((u) => u.user_id !== user?.id)
                  .map((u, i) => (
                    <div key={u.user_id || i} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                          {u.name ? u.name[0] : 'U'}
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{u.name || 'Collaborator'}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 flex items-center space-x-1">
                        <span>{u.role || 'Editing'}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      </span>
                    </div>
                  ))}
              </div>

              {userRole === 'OWNER' && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-full mt-4 flex items-center justify-center space-x-2 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite Collaborators</span>
                </button>
              )}
            </div>

            {/* Document Details & Quick Actions */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Document Info</h4>
                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p><span className="font-semibold text-slate-800">Title:</span> {documentData.title}</p>
                  <p><span className="font-semibold text-slate-800">Owner:</span> {documentData.owner_name || documentData.owner_email || 'You'}</p>
                  <p><span className="font-semibold text-slate-800">Your Role:</span> <span className="font-bold text-brand-600 uppercase">{userRole}</span></p>
                  <p><span className="font-semibold text-slate-800">Created:</span> {documentData.created_at ? new Date(documentData.created_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => { setShowCommentsPanel(true); setShowVersionPanel(false); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                >
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-brand-600" />
                    <span>View Comments</span>
                  </div>
                  <span className="text-slate-400">→</span>
                </button>

                <button
                  onClick={() => { setShowVersionPanel(true); setShowCommentsPanel(false); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                >
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-brand-600" />
                    <span>Version History</span>
                  </div>
                  <span className="text-slate-400">→</span>
                </button>
              </div>
            </div>
          </aside>
        </>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          documentId={id}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export const DocumentEditorPage = () => (
  <DocumentErrorBoundary>
    <DocumentEditorPageInner />
  </DocumentErrorBoundary>
);
