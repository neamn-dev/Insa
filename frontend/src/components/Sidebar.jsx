import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText, LayoutDashboard, FolderOpen, Users, Clock, Star,
  Plus, Shield, LogOut, X
} from 'lucide-react';

const mainNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'all', label: 'All Documents', icon: FolderOpen },
  { id: 'my', label: 'Owned by me', icon: FileText },
  { id: 'shared', label: 'Shared with me', icon: Users },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
];

export const Sidebar = ({ activeTab = 'dashboard', onTabChange, onNewDocument, documents = [], isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavClick = (item) => {
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
    if (onTabChange) {
      if (item.id === 'dashboard') onTabChange('my');
      else onTabChange(item.id);
    }
    if (onClose) onClose();
  };

  const myDocs = Array.isArray(documents) ? documents : [];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`w-[260px] bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 bottom-0 z-50 shadow-xl border-r border-slate-800 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo & Close Button */}
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { navigate('/dashboard'); if (onClose) onClose(); }}>
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold font-heading text-white tracking-tight">SyncWrite</span>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        <nav className="space-y-0.5">
          {mainNavItems.map((item) => {
            const isActive = activeTab === item.id || (item.id === 'dashboard' && activeTab === 'my');
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* MY DOCUMENTS */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">My Documents</p>
          <div className="space-y-0.5">
            {myDocs.length === 0 ? (
              <p className="px-3 text-xs text-slate-500 italic">No documents yet</p>
            ) : (
              myDocs.slice(0, 5).map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/50 transition truncate text-left"
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 text-brand-400" />
                  <span className="truncate">{doc.title}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RECENTLY OPENED */}
        {myDocs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Recently Opened</p>
            <div className="space-y-1">
              {myDocs.slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="px-3 py-1 text-left cursor-pointer group hover:bg-slate-800/40 rounded-lg transition"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-slate-300 group-hover:text-white truncate font-medium">{doc.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sessions & Audit */}
      <div className="px-3 py-1.5 border-t border-slate-800">
        <button
          onClick={() => navigate('/sessions')}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Sessions & Security</span>
        </button>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold uppercase flex-shrink-0 ring-2 ring-brand-400/30">
              {user?.name ? user.name[0] : user?.email?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition flex-shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  </>
);
};


