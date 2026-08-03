import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Shield, LogOut, User } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-bold font-heading text-slate-900 tracking-tight">SyncWrite</span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 font-medium rounded-full border border-blue-200">Real-time CRDT</span>
          </div>
        </Link>

        {user && (
          <div className="flex items-center space-x-4">
            <Link
              to="/sessions"
              className="flex items-center space-x-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
              title="Session Management & Audit Log"
            >
              <Shield className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">Sessions & Audit</span>
            </Link>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-semibold uppercase">
                {user.name ? user.name[0] : user.email[0]}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
