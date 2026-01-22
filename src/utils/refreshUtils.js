// Refresh Utilities for KCL Manager
// Handles cache clearing, version checking, and forced updates

import { APP_VERSION } from '../version';

/**
 * Force a hard refresh of the application
 * Clears all caches and reloads the page
 */
export const forceHardRefresh = () => {
  try {
    // Save current version BEFORE clearing cache
    // This prevents the update popup from showing again after refresh
    saveCurrentVersion();
    
    // Clear browser cache
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    // Clear service worker cache if present
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }
    
    // Force reload without cache
    window.location.reload(true);
  } catch (error) {
    console.error('Error during hard refresh:', error);
    // Fallback to simple reload
    window.location.reload();
  }
};

/**
 * Get the currently stored version from localStorage
 */
export const getStoredVersion = () => {
  return localStorage.getItem('kcl_app_version') || '1.0.0';
};

/**
 * Save the current version to localStorage
 */
export const saveCurrentVersion = () => {
  localStorage.setItem('kcl_app_version', APP_VERSION);
  localStorage.setItem('kcl_last_refresh', new Date().toISOString());
};

/**
 * Check if app needs updating
 * Returns true if stored version differs from current version
 */
export const needsUpdate = () => {
  const stored = getStoredVersion();
  const current = APP_VERSION;
  
  // If no stored version, assume first load
  if (!stored) {
    saveCurrentVersion();
    return false;
  }
  
  // Compare versions
  return stored !== current;
};

/**
 * Check if user has seen this version
 */
export const hasSeenVersion = () => {
  return getStoredVersion() === APP_VERSION;
};

/**
 * Mark current version as seen
 */
export const markVersionAsSeen = () => {
  saveCurrentVersion();
};

/**
 * Get time since last refresh
 */
export const getTimeSinceLastRefresh = () => {
  const lastRefresh = localStorage.getItem('kcl_last_refresh');
  if (!lastRefresh) return null;
  
  const lastRefreshDate = new Date(lastRefresh);
  const now = new Date();
  const diffMs = now - lastRefreshDate;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return 'Just now';
};

/**
 * Auto-update check on app load
 * Shows update prompt if new version available
 */
export const checkForUpdates = () => {
  if (needsUpdate()) {
    return {
      hasUpdate: true,
      oldVersion: getStoredVersion(),
      newVersion: APP_VERSION
    };
  }
  return { hasUpdate: false };
};