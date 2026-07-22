// Authentication manager for EcoCircle
import { authService } from './firebase-config.js';

let currentUser = null;

export function getLoggedInUser() {
  return currentUser;
}

export function initAuth(showToast) {
  const authContainer = document.getElementById('authContainer');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const otpForm = document.getElementById('otpForm');
  
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const tabOtp = document.getElementById('tabOtp');
  
  // Sidebar user widgets
  const sidebarUserWidget = document.getElementById('sidebarUserWidget');
  const userAvatar = document.getElementById('userAvatar');
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  const logoutBtn = document.getElementById('logoutBtn');

  // Input sanitization: Automatically strip spaces in email inputs (useful for mobile keyboards)
  const loginEmail = document.getElementById('loginEmail');
  const registerEmail = document.getElementById('registerEmail');
  const otpEmail = document.getElementById('otpEmail');
  const loginConfigContainer = document.getElementById('loginConfigContainer');
  function checkEmailForAdmin(val) {
    if (!val) return false;
    const email = val.toLowerCase().trim();
    return email.includes('admin') || email === 'ashrithap2200.sse@saveetha.com';
  }

  if (loginEmail) {
    loginEmail.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\s+/g, '');
      if (loginConfigContainer) {
        const is_admin = checkEmailForAdmin(e.target.value);
        loginConfigContainer.style.display = is_admin ? 'block' : 'none';
      }
    });
  }
  if (registerEmail) {
    registerEmail.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\s+/g, '');
    });
  }
  if (otpEmail) {
    otpEmail.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\s+/g, '');
    });
  }

  // Welcome Screen Tab Switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    if (tabOtp) tabOtp.classList.remove('active');
    tabRegister.classList.remove('active');
    loginForm.classList.add('active');
    if (otpForm) otpForm.classList.remove('active');
    registerForm.classList.remove('active');
    if (loginConfigContainer && loginEmail) {
      const is_admin = checkEmailForAdmin(loginEmail.value);
      loginConfigContainer.style.display = is_admin ? 'block' : 'none';
    }
  });

  if (tabOtp) {
    tabOtp.addEventListener('click', () => {
      tabOtp.classList.add('active');
      tabLogin.classList.remove('active');
      tabRegister.classList.remove('active');
      if (otpForm) otpForm.classList.add('active');
      loginForm.classList.remove('active');
      registerForm.classList.remove('active');
      if (loginConfigContainer) loginConfigContainer.style.display = 'none';
    });
  }

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    if (tabOtp) tabOtp.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
    if (otpForm) otpForm.classList.remove('active');
    if (loginConfigContainer) loginConfigContainer.style.display = 'none';
  });

  // Login Form Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    // Clear any previous inline error
    const existingErr = loginForm.querySelector('.form-error-banner');
    if (existingErr) existingErr.remove();

    if (!email || !password) {
      showInlineError(loginForm, submitBtn, 'Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showInlineError(loginForm, submitBtn, 'Please enter a valid email address (e.g. ashrithap2200.sse@saveetha.com).');
      return;
    }

    try {
      setLoadingState(submitBtn, true, 'Signing In...');
      localStorage.setItem('EcoCircle_auth_in_progress', 'true');
      const user = await authService.login(email, password);
      if (user && user.activeSessionId) {
        localStorage.setItem('EcoCircle_session_id', user.activeSessionId);
      }
      showToast('Welcome back to EcoCircle!', 'success');
      loginForm.reset();
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Login failed. Please check your email and password.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        msg = 'Network connection error. Please check your internet connection or ensure your backend server is accessible.';
      }
      showInlineError(loginForm, submitBtn, msg);
      showToast(msg, 'error');
    } finally {
      localStorage.removeItem('EcoCircle_auth_in_progress');
      setLoadingState(submitBtn, false, 'Sign In');
    }
  });




  // Register Form Submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const location = document.getElementById('registerLocation').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    if (!name || !email || !location || !password || !confirmPassword) {
      showToast('All registration fields are required.', 'warning');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    try {
      setLoadingState(submitBtn, true, 'Creating Account...');
      localStorage.setItem('EcoCircle_auth_in_progress', 'true');
      const response = await authService.register(email, password, name, location);
      
      if (response && response.verificationRequired) {
        showToast('Registration successful! Check your email to verify.', 'success');
        showInlineSuccess(registerForm, submitBtn, 'Account created! Please check your email inbox to verify and activate your account.');
        registerForm.reset();
      } else {
        if (response && response.activeSessionId) {
          localStorage.setItem('EcoCircle_session_id', response.activeSessionId);
        }
        showToast('Account created successfully! Welcome!', 'success');
        registerForm.reset();
        // Clear any inline errors
        const existingErr = registerForm.querySelector('.form-error-banner');
        if (existingErr) existingErr.remove();
        const existingSucc = registerForm.querySelector('.form-success-banner');
        if (existingSucc) existingSucc.remove();
      }
    } catch (err) {
      console.error(err);
      const msg = err.message || 'Registration failed.';
      showInlineError(registerForm, submitBtn, msg);
      showToast(msg, 'error');
    } finally {
      localStorage.removeItem('EcoCircle_auth_in_progress');
      setLoadingState(submitBtn, false, 'Sign Up');
    }
  });



  // Logout Action
  logoutBtn.addEventListener('click', async () => {
    try {
      localStorage.removeItem('EcoCircle_session_id');
      await authService.logout();
      showToast('Logged out successfully.', 'info');
      // Redirect to dashboard page state to avoid viewing protected pages after logout
      window.location.hash = '#dashboard';
    } catch (err) {
      console.error(err);
      showToast('Failed to log out.', 'error');
    }
  });

  // Listen for Authentication State Changes
  authService.onAuthStateChanged((user) => {
    if (user) {
      const cachedSessionId = localStorage.getItem('EcoCircle_session_id');
      const authInProgress = localStorage.getItem('EcoCircle_auth_in_progress') === 'true';

      if (user.activeSessionId && !authInProgress) {
        if (!cachedSessionId) {
          localStorage.setItem('EcoCircle_session_id', user.activeSessionId);
        } else if (cachedSessionId !== user.activeSessionId) {
          console.warn('Session mismatch detected. Logging out...');
          localStorage.removeItem('EcoCircle_session_id');
          authService.logout().then(() => {
            showToast('You have been logged out because this account logged in from another location.', 'warning');
          }).catch(err => {
            console.error('Forced logout failed:', err);
          });
          return;
        }
      }
    } else {
      localStorage.removeItem('EcoCircle_session_id');
    }

    currentUser = user;
    const pendingApprovalContainer = document.getElementById('pendingApprovalContainer');
    const navAdminItem = document.getElementById('navAdminItem');

    if (user) {
      if (user.approved === true) {
        // Trigger congratulations toast if we transitioned from pending screen
        if (pendingApprovalContainer && pendingApprovalContainer.style.display === 'flex') {
          showToast('Congratulations! Your account has been approved by the admin.', 'success');
        }
        // Hide pending approval page
        if (pendingApprovalContainer) pendingApprovalContainer.style.display = 'none';

        // Show/hide admin sidebar nav and mobile admin bottom nav link
        const mobileNavAdmin = document.getElementById('mobileNavAdmin');
        const navSettingsItem = document.getElementById('navSettingsItem');
        const mobileNavSettings = document.getElementById('mobileNavSettings');
        if (navAdminItem) {
          if (user.role === 'admin') {
            navAdminItem.style.display = 'block';
            if (mobileNavAdmin) mobileNavAdmin.style.display = 'flex';
          } else {
            navAdminItem.style.display = 'none';
            if (mobileNavAdmin) mobileNavAdmin.style.display = 'none';
            if (window.location.hash === '#admin') {
              window.location.hash = '#dashboard';
            }
          }
        }
        
        if (navSettingsItem) {
          if (user.role === 'admin') {
            navSettingsItem.style.display = 'block';
            if (mobileNavSettings) mobileNavSettings.style.display = 'flex';
          } else {
            navSettingsItem.style.display = 'none';
            if (mobileNavSettings) mobileNavSettings.style.display = 'none';
            if (window.location.hash === '#settings') {
              window.location.hash = '#dashboard';
            }
          }
        }

        // User is logged in and approved
        authContainer.classList.remove('active');
        sidebarUserWidget.style.display = 'flex';
        
        // Setup profile view
        userNameEl.textContent = user.displayName;
        const roleLabel = user.role === 'admin' ? 'Community Admin' : 'Resident';
        userRoleEl.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="margin-right: 2px;">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${user.location} (${roleLabel})
        `;
        userAvatar.textContent = user.displayName.charAt(0).toUpperCase();
        
        // Dispatch authentication changed custom event to trigger listings refresh
        document.dispatchEvent(new CustomEvent('auth-changed', { detail: user }));
      } else {
        // Logged in but NOT approved!
        authContainer.classList.remove('active');
        sidebarUserWidget.style.display = 'none';
        if (navAdminItem) navAdminItem.style.display = 'none';
        const mobileNavAdmin = document.getElementById('mobileNavAdmin');
        if (mobileNavAdmin) mobileNavAdmin.style.display = 'none';

        if (pendingApprovalContainer) {
          pendingApprovalContainer.style.display = 'flex';

          const iconContainer = document.getElementById('pendingApprovalIcon');
          const titleEl = document.getElementById('pendingApprovalTitle');
          const descEl = document.getElementById('pendingApprovalDesc');

          if (user.status === 'rejected') {
            iconContainer.innerHTML = `
              <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" stroke-width="1.5" fill="none" style="color: var(--danger);">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            `;
            titleEl.textContent = 'Registration Rejected';
            descEl.textContent = 'Your membership request has been rejected by the community admin. If you believe this is a mistake, please contact support or register with a different email.';
          } else {
            iconContainer.innerHTML = `
              <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" stroke-width="1.5" fill="none" style="color: var(--warning);">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            `;
            titleEl.textContent = 'Account Pending Approval';
            descEl.textContent = 'Thank you for registering! Your membership request has been submitted to the community admin for approval. Please check back later.';
          }
        }

        // Clear dashboard data in background
        document.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
      }
    } else {
      // User is logged out
      if (pendingApprovalContainer) pendingApprovalContainer.style.display = 'none';
      if (navAdminItem) navAdminItem.style.display = 'none';
      const mobileNavAdmin = document.getElementById('mobileNavAdmin');
      if (mobileNavAdmin) mobileNavAdmin.style.display = 'none';
      
      const navSettingsItem = document.getElementById('navSettingsItem');
      const mobileNavSettings = document.getElementById('mobileNavSettings');
      if (navSettingsItem) navSettingsItem.style.display = 'none';
      if (mobileNavSettings) mobileNavSettings.style.display = 'none';

      authContainer.classList.add('active');
      sidebarUserWidget.style.display = 'none';
      document.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
    }
  });

  // Bind pending overlay sign-out trigger
  const pendingSignOutBtn = document.getElementById('pendingSignOutBtn');
  if (pendingSignOutBtn) {
    pendingSignOutBtn.addEventListener('click', async () => {
      try {
        localStorage.removeItem('EcoCircle_session_id');
        await authService.logout();
        showToast('Signed out successfully.', 'info');
        const pendingApprovalContainer = document.getElementById('pendingApprovalContainer');
        if (pendingApprovalContainer) pendingApprovalContainer.style.display = 'none';
      } catch (err) {
        console.error(err);
        showToast('Failed to sign out.', 'error');
      }
    });
  }
}

// Helper to disable buttons during operations
function setLoadingState(button, isLoading, text) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 4;">
        <circle cx="25" cy="25" r="20" stroke-dasharray="80, 200" stroke-linecap="round"></circle>
      </svg>
      ${text}
    `;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || text;
  }
}

// Helper to show a persistent inline error inside a form
function showInlineError(form, beforeEl, message) {
  // Remove any existing error banner
  const existing = form.querySelector('.form-error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'form-error-banner';
  banner.style.cssText = 'background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:8px;';
  banner.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="flex-shrink:0">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <span>${message}</span>
  `;

  // Insert before the submit button
  if (beforeEl && beforeEl.parentNode) {
    beforeEl.parentNode.insertBefore(banner, beforeEl);
  } else {
    form.appendChild(banner);
  }

  // Auto-remove after 10 seconds
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 10000);
}

// Helper to show a persistent inline success banner inside a form
function showInlineSuccess(form, beforeEl, message) {
  const existingErr = form.querySelector('.form-error-banner');
  if (existingErr) existingErr.remove();
  const existingSucc = form.querySelector('.form-success-banner');
  if (existingSucc) existingSucc.remove();

  const banner = document.createElement('div');
  banner.className = 'form-success-banner';
  banner.style.cssText = 'background:#f0fdf4;border:1px solid #86efac;color:#16a34a;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:8px;';
  banner.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="flex-shrink:0">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  if (beforeEl && beforeEl.parentNode) {
    beforeEl.parentNode.insertBefore(banner, beforeEl);
  } else {
    form.appendChild(banner);
  }

  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 12000);
}

let adminResourcesUnsubscribe = null;
let currentAdminTab = 'analytics';

// Render the Pending Approvals Admin Panel
export async function renderAdminPanel() {
  const adminTabAnalytics = document.getElementById('adminTabAnalytics');
  const adminTabRequests = document.getElementById('adminTabRequests');
  const adminAnalyticsContent = document.getElementById('adminAnalyticsContent');
  const adminRequestsContent = document.getElementById('adminRequestsContent');
  const pendingUsersGrid = document.getElementById('pendingUsersGrid');

  if (!pendingUsersGrid) return;

  // Bind tab switching clicks once
  if (adminTabAnalytics && !adminTabAnalytics.dataset.bound) {
    adminTabAnalytics.dataset.bound = 'true';
    adminTabAnalytics.addEventListener('click', () => {
      currentAdminTab = 'analytics';
      adminTabAnalytics.classList.add('active');
      adminTabAnalytics.style.borderBottom = '2px solid var(--primary)';
      adminTabRequests.classList.remove('active');
      adminTabRequests.style.borderBottom = '2px solid transparent';
      adminAnalyticsContent.classList.add('active');
      adminAnalyticsContent.style.display = 'block';
      adminRequestsContent.classList.remove('active');
      adminRequestsContent.style.display = 'none';
    });
  }

  if (adminTabRequests && !adminTabRequests.dataset.bound) {
    adminTabRequests.dataset.bound = 'true';
    adminTabRequests.addEventListener('click', () => {
      currentAdminTab = 'requests';
      adminTabRequests.classList.add('active');
      adminTabRequests.style.borderBottom = '2px solid var(--primary)';
      adminTabAnalytics.classList.remove('active');
      adminTabAnalytics.style.borderBottom = '2px solid transparent';
      adminRequestsContent.classList.add('active');
      adminRequestsContent.style.display = 'block';
      adminAnalyticsContent.classList.remove('active');
      adminAnalyticsContent.style.display = 'none';
    });
  }

  // Restore active visual state based on currentAdminTab
  if (currentAdminTab === 'analytics') {
    if (adminTabAnalytics) {
      adminTabAnalytics.classList.add('active');
      adminTabAnalytics.style.borderBottom = '2px solid var(--primary)';
    }
    if (adminTabRequests) {
      adminTabRequests.classList.remove('active');
      adminTabRequests.style.borderBottom = '2px solid transparent';
    }
    if (adminAnalyticsContent) adminAnalyticsContent.style.display = 'block';
    if (adminRequestsContent) adminRequestsContent.style.display = 'none';
  } else {
    if (adminTabRequests) {
      adminTabRequests.classList.add('active');
      adminTabRequests.style.borderBottom = '2px solid var(--primary)';
    }
    if (adminTabAnalytics) {
      adminTabAnalytics.classList.remove('active');
      adminTabAnalytics.style.borderBottom = '2px solid transparent';
    }
    if (adminRequestsContent) adminRequestsContent.style.display = 'block';
    if (adminAnalyticsContent) adminAnalyticsContent.style.display = 'none';
  }

  pendingUsersGrid.innerHTML = `
    <div style="grid-column: 1 / -1; display: flex; justify-content: center; padding: 2rem;">
      <svg class="spinner" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; width: 30px; height: 30px; stroke: var(--primary); fill: none; stroke-width: 4;">
        <circle cx="25" cy="25" r="20" stroke-dasharray="80, 200" stroke-linecap="round"></circle>
      </svg>
    </div>
  `;

  try {
    const { dbService } = await import('./firebase-config.js');
    const users = await dbService.getAllUsers();
    
    // Render the user requests list
    renderUserRequestsList(users, pendingUsersGrid);

    // Subscribe to resources changes for real-time Analytics
    if (adminResourcesUnsubscribe) {
      adminResourcesUnsubscribe();
      adminResourcesUnsubscribe = null;
    }

    adminResourcesUnsubscribe = dbService.onResourcesChanged((resources) => {
      updateAnalyticsDashboard(users, resources);
    });

  } catch (err) {
    console.error('Failed to load users or resources in admin panel:', err);
    pendingUsersGrid.innerHTML = `
      <div class="no-results" style="grid-column: 1 / -1; padding: 3rem;">
        <p style="color: var(--danger); text-align: center;">Error loading admin panel: ${err.message || err}</p>
      </div>
    `;
  }
}

// Render User Request Cards
function renderUserRequestsList(users, pendingUsersGrid) {
  // Exclude currently logged in admin and other admin accounts from listing
  const listableUsers = users.filter(u => u.uid !== currentUser.uid && u.role !== 'admin');

  if (listableUsers.length === 0) {
    pendingUsersGrid.innerHTML = `
      <div class="no-results" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--text-muted); margin-bottom: 1rem; display: block; margin: 0 auto 1rem;"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
        <h3>No community requests</h3>
        <p>All users are currently approved or no other users exist.</p>
      </div>
    `;
    return;
  }

  pendingUsersGrid.innerHTML = '';
  listableUsers.forEach(u => {
    const card = document.createElement('div');
    card.className = 'resource-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.padding = '1.5rem';
    card.style.gap = '1rem';
    card.style.height = 'auto';

    const statusBadge = u.approved ? 'badge-completed' : (u.status === 'rejected' ? 'badge-shared' : 'badge-pending');
    const statusLabel = u.approved ? 'Approved' : (u.status === 'rejected' ? 'Rejected' : 'Pending Approval');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.2rem; font-family: var(--font-display); font-weight: 650; color: var(--text-main);">${u.displayName}</h3>
          <p style="margin: 0.25rem 0; color: var(--text-muted); font-size: 0.85rem;">Email: ${u.email}</p>
          <p style="margin: 0.25rem 0; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem;">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Location: ${u.location}
          </p>
        </div>
        <span class="card-badge ${statusBadge}" style="position: static; font-size: 0.75rem;">${statusLabel}</span>
      </div>
      
      <div style="display: flex; gap: 0.75rem; margin-top: auto;">
        <button class="btn btn-primary approve-user-btn" data-id="${u.uid}" style="flex: 1; font-size: 0.85rem; padding: 0.5rem 1rem;" ${u.approved ? 'disabled' : ''}>Approve</button>
        <button class="btn btn-danger reject-user-btn" data-id="${u.uid}" style="flex: 1; font-size: 0.85rem; padding: 0.5rem 1rem;" ${u.status === 'rejected' ? 'disabled' : ''}>Reject</button>
      </div>
    `;

    card.querySelector('.approve-user-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const origText = btn.textContent;
      try {
        btn.disabled = true;
        btn.textContent = 'Approving...';
        const { dbService } = await import('./firebase-config.js');
        await dbService.updateUserApproval(u.uid, true, 'approved');
        window.showToastNotification(`Approved user '${u.displayName}' successfully.`, 'success');
        renderAdminPanel();
      } catch (err) {
        console.error(err);
        window.showToastNotification('Failed to approve user: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = origText;
      }
    });

    card.querySelector('.reject-user-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const origText = btn.textContent;
      try {
        btn.disabled = true;
        btn.textContent = 'Rejecting...';
        const { dbService } = await import('./firebase-config.js');
        await dbService.updateUserApproval(u.uid, false, 'rejected');
        window.showToastNotification(`Rejected user '${u.displayName}'.`, 'warning');
        renderAdminPanel();
      } catch (err) {
        console.error(err);
        window.showToastNotification('Failed to reject user: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = origText;
      }
    });

    pendingUsersGrid.appendChild(card);
  });
}

// Compute & Render Analytics Statistics
function updateAnalyticsDashboard(users, resources) {
  // 1. KPI cards values
  const totalItemsEl = document.getElementById('statTotalItems');
  const activeUsersEl = document.getElementById('statActiveUsers');
  const completedExchangesEl = document.getElementById('statCompletedExchanges');
  const carbonSavedEl = document.getElementById('statCarbonSaved');

  const activeUsersCount = users.filter(u => u.approved).length;
  const completedCount = resources.filter(r => r.status === 'Completed' || r.status === 'Shared').length;
  const carbonSavedVal = (resources.length * 2.5).toFixed(1);

  if (totalItemsEl) totalItemsEl.textContent = resources.length;
  if (activeUsersEl) activeUsersEl.textContent = activeUsersCount;
  if (completedExchangesEl) completedExchangesEl.textContent = completedCount;
  if (carbonSavedEl) carbonSavedEl.textContent = carbonSavedVal;

  // 2. Render Donut Chart
  const categories = ['Food', 'Clothes', 'Books', 'Furniture', 'Electronics', 'Kitchen Items', 'Medical Supplies', 'Educational Materials', 'Household Items', 'Other'];
  const catCounts = {};
  categories.forEach(cat => { catCounts[cat] = 0; });
  resources.forEach(res => {
    const cat = res.category || 'Other';
    if (catCounts[cat] !== undefined) {
      catCounts[cat]++;
    } else {
      catCounts['Other']++;
    }
  });

  const activeCategories = categories.map(cat => ({
    name: cat,
    count: catCounts[cat]
  })).filter(c => c.count > 0);

  const themeColors = [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#6b7280'  // gray
  ];

  const donutWrapper = document.getElementById('categoryDonutWrapper');
  const legendList = document.getElementById('categoryLegendList');

  if (donutWrapper && legendList) {
    if (resources.length === 0) {
      donutWrapper.innerHTML = `
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: var(--text-muted); text-align: center;">
          No shares yet
        </div>
      `;
      legendList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin: 0;">No shared items yet.</p>`;
    } else {
      let svgContent = `<svg viewBox="0 0 120 120" width="100%" height="100%" style="transform: rotate(-90deg);">`;
      const r = 40;
      const cx = 60;
      const cy = 60;
      const C = 2 * Math.PI * r;
      
      let currentOffset = 0;
      let legendHtml = '';
      
      activeCategories.forEach((cat, index) => {
        const percentage = (cat.count / resources.length) * 100;
        const sliceLength = (cat.count / resources.length) * C;
        const color = themeColors[index % themeColors.length];
        
        svgContent += `
          <circle 
            cx="${cx}" 
            cy="${cy}" 
            r="${r}" 
            fill="transparent" 
            stroke="${color}" 
            stroke-width="15" 
            stroke-dasharray="${sliceLength} ${C}" 
            stroke-dashoffset="-${currentOffset}"
            style="transition: stroke-dashoffset 0.8s ease;"
          >
            <title>${cat.name}: ${cat.count} (${percentage.toFixed(0)}%)</title>
          </circle>
        `;
        
        currentOffset += sliceLength;
        
        legendHtml += `
          <div class="chart-legend-item">
            <div style="display: flex; align-items: center;">
              <span class="chart-legend-color" style="background-color: ${color};"></span>
              <span style="font-weight: 600;">${cat.name}</span>
            </div>
            <span style="font-weight: 700; color: var(--text-muted);">${cat.count} (${percentage.toFixed(0)}%)</span>
          </div>
        `;
      });
      
      // Central text circle
      svgContent += `
        <circle cx="${cx}" cy="${cy}" r="32" fill="var(--bg-card)" />
        <text x="${cx}" y="${cy + 4}" font-family="var(--font-headings)" font-size="9" font-weight="800" text-anchor="middle" fill="var(--text-main)" transform="rotate(90 ${cx} ${cy})">
          ${resources.length} Shares
        </text>
      `;
      svgContent += `</svg>`;
      
      donutWrapper.innerHTML = svgContent;
      legendList.innerHTML = legendHtml;
    }
  }

  // 3. Render Sharing Activity Over Time (monthly)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last6Months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: monthNames[d.getMonth()],
      count: 0
    });
  }

  resources.forEach(res => {
    if (!res.createdAt) return;
    const date = new Date(res.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const match = last6Months.find(m => m.year === year && m.month === month);
    if (match) {
      match.count++;
    }
  });

  const maxCount = Math.max(...last6Months.map(m => m.count), 1);
  const barsContainer = document.getElementById('activityChartBars');
  const labelsContainer = document.getElementById('activityChartLabels');

  if (barsContainer && labelsContainer) {
    let barsHtml = '';
    let labelsHtml = '';
    
    last6Months.forEach(m => {
      const heightPercent = (m.count / maxCount) * 85; // leave room at the top
      barsHtml += `
        <div class="chart-bar-col">
          <div class="chart-bar-wrapper">
            <div class="chart-bar-value" style="height: ${Math.max(heightPercent, 5)}%;">
              <div class="chart-bar-tooltip">${m.count} shares</div>
            </div>
          </div>
        </div>
      `;
      labelsHtml += `<div style="flex: 1; text-align: center; font-weight: 600;">${m.label}</div>`;
    });
    
    barsContainer.innerHTML = barsHtml;
    labelsContainer.innerHTML = labelsHtml;
  }

  // 4. Render Top Contributors
  const contributorCounts = {};
  resources.forEach(res => {
    const name = res.ownerName || 'Anonymous Resident';
    const ownerId = res.ownerId || 'anonymous';
    const loc = res.location || 'Community Center';
    
    if (!contributorCounts[ownerId]) {
      contributorCounts[ownerId] = {
        name,
        location: loc,
        count: 0
      };
    }
    contributorCounts[ownerId].count++;
  });

  const sortedContributors = Object.values(contributorCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const leaderboardBody = document.getElementById('leaderboardBody');
  if (leaderboardBody) {
    if (sortedContributors.length === 0) {
      leaderboardBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No sharing activities recorded yet.
          </td>
        </tr>
      `;
    } else {
      let tbodyHtml = '';
      sortedContributors.forEach((c, index) => {
        const rank = index + 1;
        let rankClass = 'rank-other';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        
        tbodyHtml += `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 1rem;">
              <span class="leaderboard-rank ${rankClass}">${rank}</span>
            </td>
            <td style="padding: 1rem; font-weight: 700;">${c.name}</td>
            <td style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">${c.location}</td>
            <td style="padding: 1rem; text-align: right; font-weight: 750; color: var(--primary);">${c.count} items</td>
          </tr>
        `;
      });
      leaderboardBody.innerHTML = tbodyHtml;
    }
  }
}

window.renderAdminPanel = renderAdminPanel;
