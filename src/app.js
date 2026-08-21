import { initAuth } from './auth.js';
import { initResources, renderResources } from './resources.js';
import { initChats } from './chats.js';
import { initAIAssistant } from './ai-assistant.js';
import { initEvents } from './events.js';
import { 
  tryInitializeFirebase, 
  tryInitializeSupabase,
  tryInitializeMysql,
  removeCloudConfig, 
  getActiveProviderName, 
  getActiveProviderType,
  onProviderChanged 
} from './firebase-config.js';

// Clear any stale cached sessions and force live Supabase cloud sync across Web and Mobile
if (!localStorage.getItem('EcoCircle_force_sync_v5')) {
  localStorage.removeItem('EcoCircle_users_cache');
  localStorage.removeItem('EcoCircle_community_events');
  localStorage.removeItem('EcoCircle_active_provider_type');
  localStorage.setItem('EcoCircle_active_provider_type', 'supabase');
  localStorage.setItem('EcoCircle_force_sync_v5', 'true');
}

// Global Toast System
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      break;
    case 'error':
      icon = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
      break;
    case 'warning':
      icon = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      break;
    default:
      icon = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger exit transition
  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// Make toast system globally accessible
window.showToastNotification = showToast;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Modules
  initAuth(showToast);
  initResources(showToast);
  initChats(showToast);
  initAIAssistant(showToast);
  initEvents(showToast);

  // 2. Client Side Routing (Sidebar & Mobile bottom nav triggers)
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-item');
  const sections = document.querySelectorAll('.content-section');

  function handleRoute(hash) {
    const targetId = hash.replace('#', '') || 'dashboard';
    
    // Deactivate all
    navLinks.forEach(link => link.classList.remove('active'));
    sections.forEach(sec => sec.classList.remove('active'));

    // Redirect legacy settings route to dashboard
    if (targetId === 'settings') {
      window.location.hash = '#dashboard';
      return;
    }

    // Activate target section
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      targetSection.classList.add('active');
      
      const activeLinks = document.querySelectorAll(`.nav-link[href="#${targetId}"], .mobile-nav-item[href="#${targetId}"]`);
      activeLinks.forEach(link => link.classList.add('active'));

      // If returning to dashboard, trigger resources re-render to lay out Leaflet map if active
      if (targetId === 'dashboard') {
        renderResources();
      } else if (targetId === 'admin' && window.renderAdminPanel) {
        window.renderAdminPanel();
      }
    }
  }

  window.addEventListener('hashchange', () => {
    handleRoute(window.location.hash);
  });

  // Initial Route Load
  handleRoute(window.location.hash);

  // 3. Database Provider Listener
  onProviderChanged((name, providerType) => {
    // Refresh resources to fetch from active provider
    renderResources();
  });

  // 4. Dark Theme Switcher
  const themeToggle = document.getElementById('themeToggle');
  
  // Set theme from saved settings
  const savedTheme = localStorage.getItem('EcoCircle_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('EcoCircle_theme', newTheme);
      updateThemeIcon(newTheme);
      showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled.`, 'info');
    });
  }

  function updateThemeIcon(theme) {
    if (!themeToggle) return;
    const isDark = theme === 'dark';
    const iconHtml = isDark ? `
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
    ` : `
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
    `;
    
    themeToggle.innerHTML = iconHtml;
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    if (mobileThemeToggle) {
      mobileThemeToggle.innerHTML = iconHtml;
    }
  }
  // Mobile responsive controls
  function initMobileNav() {
    const isMobile = window.innerWidth <= 768;
    const mobileTopBar = document.getElementById('mobileTopBar');
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    if (!mobileTopBar) return;
    
    // Show/hide based on screen size
    mobileTopBar.style.display = isMobile ? 'flex' : 'none';
    mobileBottomNav.style.display = isMobile ? 'flex' : 'none';
    
    // Wire mobile logout to existing logout handler
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const desktopLogoutBtn = document.getElementById('logoutBtn');
    if (mobileLogoutBtn && desktopLogoutBtn) {
      mobileLogoutBtn.onclick = (e) => {
        e.preventDefault();
        desktopLogoutBtn.click();
      };
    }
    
    // Wire mobile theme toggle to desktop toggle
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    const desktopThemeToggle = document.getElementById('themeToggle');
    if (mobileThemeToggle && desktopThemeToggle) {
      mobileThemeToggle.onclick = (e) => {
        e.preventDefault();
        desktopThemeToggle.click();
      };
    }

    // Wire mobile share button to existing desktop addResourceBtn click handler
    const mobileShareBtn = document.getElementById('mobileNavShare');
    const desktopAddBtn = document.getElementById('addResourceBtn');
    if (mobileShareBtn && desktopAddBtn) {
      mobileShareBtn.onclick = (e) => {
        e.preventDefault();
        desktopAddBtn.click();
      };
    }
  }

  function setupKeyboardHandling() {
    let initialViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    function handleFocusIn(e) {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          document.body.classList.add('keyboard-open');
        }
      }
    }

    function handleFocusOut() {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          document.body.classList.remove('keyboard-open');
        }
      }, 100);
    }

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const isMobile = window.innerWidth <= 768;
        const currentHeight = window.visualViewport.height;
        if (isMobile && (initialViewportHeight - currentHeight > 120)) {
          document.body.classList.add('keyboard-open');
        } else if (isMobile && (currentHeight >= initialViewportHeight - 50)) {
          const active = document.activeElement;
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
            document.body.classList.remove('keyboard-open');
          }
        }
      });
    }

    // Capacitor Native Keyboard Plugin Listener
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard) {
      try {
        window.Capacitor.Plugins.Keyboard.addListener('keyboardWillShow', () => {
          document.body.classList.add('keyboard-open');
        });
        window.Capacitor.Plugins.Keyboard.addListener('keyboardWillHide', () => {
          document.body.classList.remove('keyboard-open');
        });
      } catch (e) {
        console.warn('Capacitor Keyboard listener warning:', e);
      }
    }
  }

  initMobileNav();
  setupKeyboardHandling();
  window.addEventListener('resize', initMobileNav);
});
