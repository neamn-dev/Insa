/**
 * AuthGuard - Frontend Script
 * Handles: alert banners, authenticated API requests with automatic token refresh,
 * background token renewal, and seamless route protection.
 */

// ===== Alert Banner Helper =====
function showAlert(type, message) {
  const alert = document.getElementById('alert');
  const icon = document.getElementById('alert-icon');
  const msg = document.getElementById('alert-message');

  if (!alert || !msg) return;

  // Remove all alert type classes
  alert.className = 'alert show';
  alert.classList.add(`alert-${type}`);

  const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
  if (icon) icon.textContent = icons[type] || 'ℹ️';
  msg.textContent = message;

  // Auto-dismiss after 6 seconds
  setTimeout(() => {
    alert.classList.remove('show');
  }, 6000);
}

// ===== Seamless Route Protection & Token Assurance =====
async function ensureAuthenticated() {
  let token = sessionStorage.getItem('access_token');
  if (!token) {
    // Attempt silent refresh using httpOnly cookie before giving up
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      window.location.href = 'login.html';
      return false;
    }
  }
  return true;
}

// ===== Authenticated Fetch with Auto Token Refresh =====
async function authFetch(url, options = {}) {
  let token = sessionStorage.getItem('access_token');
  
  if (!token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      token = sessionStorage.getItem('access_token');
    } else {
      window.location.href = 'login.html';
      throw new Error('No access token');
    }
  }

  // Add auth header
  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${token}`;
  options.credentials = 'include';

  let res = await fetch(url, options);

  // If 401, try refreshing the token automatically
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with newly issued access token
      const newToken = sessionStorage.getItem('access_token');
      options.headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, options);
    } else {
      // Refresh failed — redirect to login
      sessionStorage.removeItem('access_token');
      window.location.href = 'login.html';
      throw new Error('Session expired');
    }
  }

  return res;
}

// ===== Refresh Token Flow =====
async function tryRefreshToken() {
  try {
    const res = await fetch('/api/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        sessionStorage.setItem('access_token', data.access_token);
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ===== Background Silent Token Renewal =====
// Automatically refresh 5-minute access token every 3 minutes in background
setInterval(async () => {
  if (sessionStorage.getItem('access_token')) {
    await tryRefreshToken();
  }
}, 3 * 60 * 1000);
