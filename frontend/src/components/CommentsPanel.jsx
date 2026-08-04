import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { MessageSquare, CheckCircle, Trash2, Reply, Send, X, MoreHorizontal, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AVATAR_COLORS = [
  'bg-yellow-500', 'bg-brand-500', 'bg-cyan-500',
  'bg-rose-500', 'bg-emerald-500', 'bg-orange-500'
];

export const CommentsPanel = ({ documentId, userRole, onClose }) => {
  const { user, accessToken } = useAuth();
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('open'); // 'open' | 'resolved'
  const [newComment, setNewComment] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  const canAddComment = ['OWNER', 'EDITOR', 'COMMENTER'].includes(userRole);

  const fetchComments = async () => {
    try {
      const res = await api.get(`/api/documents/${documentId}/comments`);
      setComments(res.data.comments || []);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();

    const socket = getSocket(accessToken);
    const handleCommentUpdate = (data) => {
      if (data && data.document_id === documentId) {
        fetchComments();
      }
    };

    socket.on('comment:update', handleCommentUpdate);
    return () => {
      socket.off('comment:update', handleCommentUpdate);
    };
  }, [documentId, accessToken]);

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !canAddComment) return;

    try {
      await api.post(`/api/documents/${documentId}/comments`, { content: newComment });
      setNewComment('');
      setShowAddForm(false);
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add comment');
    }
  };

  const handleCreateReply = async (parentId) => {
    if (!replyText.trim() || !canAddComment) return;

    try {
      await api.post(`/api/documents/${documentId}/comments`, { content: replyText, parent_id: parentId });
      setReplyText('');
      setReplyingTo(null);
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reply');
    }
  };

  const handleToggleResolve = async (commentId, currentResolved) => {
    try {
      await api.put(`/api/comments/${commentId}/resolve`, { resolved: !currentResolved });
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/api/comments/${commentId}`);
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete comment');
    }
  };

  const filteredComments = comments.filter(c => activeTab === 'resolved' ? c.resolved : !c.resolved);

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 lg:hidden"
        onClick={onClose}
      />
      <aside className="w-full sm:w-80 bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl z-40 animate-slideInLeft fixed lg:relative inset-y-0 right-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold font-heading text-slate-900 text-base">Comments</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('open')}
          className={`py-2.5 mr-6 transition relative ${activeTab === 'open' ? 'text-brand-600 border-b-2 border-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Open
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`py-2.5 transition relative ${activeTab === 'resolved' ? 'text-brand-600 border-b-2 border-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Resolved
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Loading comments...</p>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No {activeTab} comments yet.</p>
          </div>
        ) : (
          filteredComments.map((comment, index) => (
            <div
              key={comment.id}
              className={`p-3.5 rounded-xl border transition ${comment.resolved ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-7 h-7 rounded-full ${AVATAR_COLORS[index % AVATAR_COLORS.length]} text-white flex items-center justify-center text-xs font-bold uppercase`}>
                    {comment.author_name ? comment.author_name[0] : 'U'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">{comment.author_name}</span>
                    <span className="text-[10px] text-slate-400">{comment.created_at ? new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {canAddComment && (
                    <button
                      onClick={() => handleToggleResolve(comment.id, comment.resolved)}
                      className={`p-1 rounded hover:bg-slate-100 ${comment.resolved ? 'text-emerald-600' : 'text-slate-400'}`}
                      title={comment.resolved ? 'Unresolve' : 'Resolve'}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(comment.author_id === user?.id || userRole === 'OWNER') && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-normal mb-2.5 pl-9">{comment.content}</p>

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-9 space-y-2 mb-2.5">
                  {comment.replies.map((reply, rIdx) => (
                    <div key={reply.id} className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className={`w-5 h-5 rounded-full ${AVATAR_COLORS[(index + rIdx + 1) % AVATAR_COLORS.length]} text-white flex items-center justify-center text-[10px] font-bold uppercase`}>
                          {reply.author_name ? reply.author_name[0] : 'U'}
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">{reply.author_name}</span>
                      </div>
                      <p className="text-slate-600 pl-7 text-xs">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Button & Input */}
              <div className="pl-9">
                {replyingTo === comment.id ? (
                  <div className="flex items-center space-x-1.5 mt-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      autoFocus
                      className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                    />
                    <button onClick={() => handleCreateReply(comment.id)} className="p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition">
                      <Send className="w-3 h-3" />
                    </button>
                    <button onClick={() => setReplyingTo(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  canAddComment && (
                    <button
                      onClick={() => { setReplyingTo(comment.id); setReplyText(''); }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition"
                    >
                      Reply
                    </button>
                  )
                )}
              </div>
            </div>
          ))
        )}

        {/* Add comment inline form when triggered */}
        {showAddForm && (
          <form onSubmit={handleCreateComment} className="p-3 bg-brand-50/50 border border-brand-200 rounded-xl space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              autoFocus
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white resize-none"
            />
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs bg-brand-600 text-white font-semibold rounded-md hover:bg-brand-700"
              >
                Post
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bottom Button */}
      {canAddComment && !showAddForm && (
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 border border-brand-300 hover:bg-brand-50 text-brand-600 font-semibold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add a comment</span>
          </button>
        </div>
      )}
      </aside>
    </>
  );
};
