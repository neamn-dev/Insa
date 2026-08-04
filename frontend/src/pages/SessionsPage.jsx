import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Navbar } from '../components/Navbar';
import { Shield, Smartphone, Globe, Clock, Trash2, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

export const SessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        api.get('/api/auth/sessions'),
        api.get('/api/auth/login-history')
      ]);
      setSessions(sRes.data.sessions || []);
      setLoginHistory(hRes.data.history || []);
    } catch (err) {
      console.error('Failed to fetch session data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRevokeSession = async (sessionId) => {
    try {
      await api.post('/api/auth/sessions/revoke', { session_id: sessionId });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke session.');
    }
  };

  const handleRevokeAllOther = async () => {
    if (!confirm('Are you sure you want to revoke all other active sessions?')) return;
    try {
      await api.post('/api/auth/sessions/revoke', { revoke_all_other: true });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke other sessions.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">Session Management & Audit Log</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Monitor active sessions, security alerts, and login history</p>
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold font-heading text-slate-900">Active Sessions</h2>
            </div>

            {sessions.filter(s => !s.is_current).length > 0 && (
              <button
                onClick={handleRevokeAllOther}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs rounded-xl transition border border-red-200"
              >
                Revoke All Other Sessions
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-400">No active sessions found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border ${s.is_current ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-200'} flex items-start justify-between`}
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <Smartphone className="w-4 h-4 text-slate-600" />
                      <span className="font-bold text-slate-900 truncate max-w-xs">{s.user_agent}</span>
                      {s.is_current && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Current Session
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-slate-500">
                      <Globe className="w-3.5 h-3.5" />
                      <span>IP: {s.ip_address}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Last Active: {s.last_active}</span>
                    </div>
                  </div>

                  {!s.is_current && (
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Revoke Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Login Audit History */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold font-heading text-slate-900">Login Activity Audit Log</h2>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading audit history...</p>
          ) : loginHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No login attempts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2">Attempted Email</th>
                    <th className="pb-3 px-2">Device / User Agent</th>
                    <th className="pb-3 px-2">IP Address</th>
                    <th className="pb-3 px-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-2">
                        {item.success ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Success</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-bold">
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800">{item.email_attempted}</td>
                      <td className="py-3 px-2 text-slate-600 max-w-xs truncate">{item.user_agent}</td>
                      <td className="py-3 px-2 text-slate-500">{item.ip_address}</td>
                      <td className="py-3 px-2 text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
