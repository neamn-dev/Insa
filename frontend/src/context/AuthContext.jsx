import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);
  const [suspiciousLogin, setSuspiciousLogin] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setUser(res.data.user);
    } catch (err) {
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for cookie transfer from Google OAuth redirect
    const cookies = document.cookie.split('; ').reduce((acc, current) => {
      const parts = current.split('=');
      if (parts.length >= 2) {
        acc[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
      return acc;
    }, {});

    const transferToken = cookies.access_token_transfer;
    if (transferToken) {
      sessionStorage.setItem('access_token', transferToken);
      setAccessToken(transferToken);
      // clear cookie
      document.cookie = 'access_token_transfer=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }

    const tokenToUse = transferToken || sessionStorage.getItem('access_token');
    if (tokenToUse) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }

    const handleUnauthorized = () => {
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('access_token');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { access_token, user: userData, suspicious_login, previous_device } = res.data;
    sessionStorage.setItem('access_token', access_token);
    setAccessToken(access_token);
    setUser(userData);
    if (suspicious_login) {
      setSuspiciousLogin({ previous_device });
    } else {
      setSuspiciousLogin(null);
    }
    return res.data;
  };

  const loginWithFirebaseToken = async (idToken) => {
    const res = await api.post('/api/auth/firebase', { token: idToken });
    const { access_token, user: userData, suspicious_login, previous_device } = res.data;
    sessionStorage.setItem('access_token', access_token);
    setAccessToken(access_token);
    setUser(userData);
    if (suspicious_login) {
      setSuspiciousLogin({ previous_device });
    } else {
      setSuspiciousLogin(null);
    }
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // Ignore
    } finally {
      sessionStorage.removeItem('access_token');
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      loading,
      suspiciousLogin,
      clearSuspiciousNotice: () => setSuspiciousLogin(null),
      login,
      loginWithFirebaseToken,
      register,
      logout,
      fetchCurrentUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
