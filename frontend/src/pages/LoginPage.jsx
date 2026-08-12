import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, checkFirebaseRedirectResult } from '../services/firebase';
import { AlertCircle, ShieldAlert, Eye, EyeOff, FileText, X } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithFirebaseToken, suspiciousLogin, clearSuspiciousNotice } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if returning from Firebase redirect
    const handleRedirectResult = async () => {
      const redirectRes = await checkFirebaseRedirectResult();
      if (redirectRes && redirectRes.success) {
        setLoading(true);
        try {
          await loginWithFirebaseToken(redirectRes.idToken);
          navigate('/dashboard');
        } catch (err) {
          setError(err.message || 'Firebase login failed.');
        } finally {
          setLoading(false);
        }
      } else if (redirectRes && !redirectRes.success) {
        setError(redirectRes.error || 'Google redirect sign-in failed.');
      }
    };
    handleRedirectResult();

    const params = new URLSearchParams(window.location.search);
    const errParam = params.get('error');
    if (errParam) {
      if (errParam === 'google_auth_failed') {
        setError('Google sign-in failed or was cancelled. Please try again.');
      } else if (errParam === 'token_exchange_failed') {
        setError('Google authentication token exchange failed. Please verify credentials.');
      } else {
        setError('An authentication error occurred. Please try again.');
      }
    }
  }, []);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err.message === 'Network Error') {
        setError('Cannot connect to authentication server. Please check backend connection.');
      } else {
        setError('Login failed. Please check your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setError(res.error || 'Firebase Google sign-in failed.');
        return;
      }
      await loginWithFirebaseToken(res.idToken);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Firebase Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* White card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 relative animate-fadeIn">

        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Login to continue to SyncWrite</p>
        </div>

        {/* Alerts */}
        {suspiciousLogin && (
          <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between text-amber-800 text-xs">
            <div className="flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Suspicious Login Detected!</p>
                <p className="mt-0.5">Previous device: <span className="font-semibold">{suspiciousLogin.previous_device}</span></p>
              </div>
            </div>
            <button onClick={clearSuspiciousNotice} className="p-1 hover:bg-amber-100 rounded-lg text-amber-700 transition" title="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between text-red-700 text-xs animate-fadeIn">
            <div className="flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
            <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg text-red-500 transition" title="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
              required
              className={`w-full px-4 py-2.5 border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition bg-white ${
                error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter your password"
                required
                className={`w-full px-4 py-2.5 border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition bg-white pr-11 ${
                  error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-brand-500/25 transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center">
          <div className="flex-1 border-t border-slate-200" />
          <span className="px-3 text-xs text-slate-400 font-medium">or continue with</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        {/* Google only */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center space-x-2.5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Sign in with Google</span>
        </button>

        <p className="mt-7 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};
