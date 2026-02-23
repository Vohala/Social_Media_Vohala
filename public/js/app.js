// ============================================================
// APP.JS — Main SPA controller + navigation
// ============================================================

window.currentUser = null;
window._notifCount = 0;
window._activeChatUserId = null;

// ---- Bootstrap ----
(async function init() {
  // Apply saved theme
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');

  if (token && savedUser) {
    try {
      window.currentUser = JSON.parse(savedUser);
      showAppUI();
      // Verify token with server
      const user = await AuthAPI.me();
      if (user) {
        window.currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
        updateNavAvatar();
        initSocket(user.id);
        loadInitialBadges();
        navigate('feed');
      }
    } catch (e) {
      showAuthPage('login');
    }
  } else {
    showAuthPage('login');
  }
})();

async function loadInitialBadges() {
  try {
    const [notifData, reqData] = await Promise.all([
      NotifAPI.list(1).catch(() => null),
      FriendsAPI.requests().catch(() => null),
    ]);
    if (notifData) {
      window._notifCount = notifData.unreadCount;
      updateNotifBadge(notifData.unreadCount);
    }
    if (reqData) updateFriendBadge(reqData.length);
  } catch (e) {}
}

// ---- Navigation ----
function navigate(page, params = {}) {
  // Close all dropdowns/menus
  document.getElementById('notification-dropdown')?.classList.add('hidden');
  document.getElementById('profile-menu')?.classList.add('hidden');

  // Update active nav buttons
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => b.classList.remove('active'));
  const navMap = { feed: 'nav-feed', friends: 'nav-friends', groups: 'nav-groups', marketplace: 'nav-marketplace' };
  if (navMap[page]) document.getElementById(navMap[page])?.classList.add('active');
  const bnavMap = { feed: 'bnav-feed', friends: 'bnav-friends', stories: 'bnav-stories', messages: 'bnav-messages', notifications: 'bnav-notif' };
  if (bnavMap[page]) document.getElementById(bnavMap[page])?.classList.add('active');

  const main = document.getElementById('main-content');

  switch (page) {
    case 'feed': renderFeedPage(main, params); break;
    case 'profile': renderProfilePage(main, params); break;
    case 'friends': renderFriendsPage(main, params); break;
    case 'messages': renderMessagesPage(main, params); break;
    case 'notifications': renderNotificationsPage(main, params); break;
    case 'stories': renderStoriesPage(main, params); break;
    case 'groups': renderGroupsPage(main, params); break;
    case 'events': renderEventsPage(main, params); break;
    case 'marketplace': renderMarketplacePage(main, params); break;
    case 'search': renderSearchPage(main, params); break;
    case 'saved': renderSavedPage(main, params); break;
    case 'settings': renderSettingsPage(main, params); break;
    default: renderFeedPage(main, params);
  }
}

// ---- Sidebar Rendering ----
function renderSidebar(activeUser) {
  const initial = (activeUser?.name || '?')[0].toUpperCase();
  const avatarHtml = activeUser?.avatar
    ? `<img src="${escapeHtml(activeUser.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<div class="sidebar-avatar-inner">${initial}</div>`;

  return `
    <div class="left-sidebar">
      <div class="sidebar-menu">
        <a class="sidebar-link" onclick="navigate('profile',{id:${activeUser?.id}})">
          <div class="sidebar-avatar">${avatarHtml}</div>
          <span>${escapeHtml(activeUser?.name || '')}</span>
        </a>
        <a class="sidebar-link" onclick="navigate('friends')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary)"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <span>Friends</span>
        </a>
        <a class="sidebar-link" onclick="navigate('groups')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary)"><path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zM11.5 1L2 6v2h19V6l-9.5-5z"/></svg>
          <span>Groups</span>
        </a>
        <a class="sidebar-link" onclick="navigate('events')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary)"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          <span>Events</span>
        </a>
        <a class="sidebar-link" onclick="navigate('marketplace')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary)"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-1.66 0-3-1.34-3-3h2c0 .55.45 1 1 1s1-.45 1-1h2c0 1.66-1.34 3-3 3z"/></svg>
          <span>Marketplace</span>
        </a>
        <a class="sidebar-link" onclick="navigate('saved')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary)"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
          <span>Saved Posts</span>
        </a>
        <a class="sidebar-link" onclick="navigate('settings')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary)"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94zM12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
          <span>Settings</span>
        </a>
      </div>
      <div class="sidebar-footer">
        <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Help</a><br/>
        Made with ❤️ in India 🇮🇳<br/>
        © 2026 Vohala
      </div>
    </div>
  `;
}

function renderRightPanel(friends) {
  const emojis = { like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😡' };
  const onlineFriends = (friends || []).filter(f => f.is_online);

  return `
    <div class="right-panel">
      ${onlineFriends.length ? `
      <div class="panel-card">
        <h4>Contacts</h4>
        ${onlineFriends.slice(0, 10).map(f => {
          const init = (f.name || '?')[0].toUpperCase();
          const av = f.avatar ? `<img src="${escapeHtml(f.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : `<div class="avatar md"><div class="avatar-inner md">${init}</div></div>`;
          return `
          <div class="contact-item" onclick="navigate('messages',{userId:${f.id}})">
            <div class="contact-avatar-wrap">
              ${av}
              <span class="online-dot"></span>
            </div>
            <span style="font-size:14px;font-weight:500">${escapeHtml(f.name)}</span>
          </div>`;
        }).join('')}
      </div>` : ''}
      <div class="memory-card">
        <h4>🌅 Good day!</h4>
        <p>What's on your mind today?</p>
      </div>
    </div>
  `;
}

// ---- Search bar ----
let searchTimeout;
document.getElementById('search-input')?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  const dropdown = document.getElementById('search-dropdown');
  if (!q) { dropdown.classList.add('hidden'); return; }
  searchTimeout = setTimeout(async () => {
    try {
      const results = await SearchAPI.search(q, 'people');
      if (!results) return;
      const people = results.people || [];
      if (!people.length) { dropdown.classList.add('hidden'); return; }
      dropdown.innerHTML = people.slice(0, 6).map(p => {
        const init = (p.name || '?')[0].toUpperCase();
        const av = p.avatar ? `<img class="avatar" src="${escapeHtml(p.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700">${init}</div>`;
        return `<div class="search-result-item" onclick="navigate('profile',{id:${p.id}});document.getElementById('search-dropdown').classList.add('hidden');document.getElementById('search-input').value=''">
          ${av}
          <div>
            <div style="font-weight:700;font-size:14px">${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:var(--text3)">@${escapeHtml(p.username)}</div>
          </div>
        </div>`;
      }).join('') + `<div class="search-result-item" onclick="navigate('search',{q:'${escapeHtml(q)}'});document.getElementById('search-dropdown').classList.add('hidden')" style="color:var(--primary);font-weight:600">
        Search for "${escapeHtml(q)}"
      </div>`;
      dropdown.classList.remove('hidden');
    } catch (e) {}
  }, 300);
});

document.getElementById('search-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) {
      navigate('search', { q });
      document.getElementById('search-dropdown').classList.add('hidden');
    }
  }
});

// ---- Toggle notifications ----
async function toggleNotifications() {
  const dropdown = document.getElementById('notification-dropdown');
  const profileMenu = document.getElementById('profile-menu');
  profileMenu.classList.add('hidden');
  if (!dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden');
    return;
  }
  dropdown.classList.remove('hidden');
  document.getElementById('notif-list').innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  try {
    const data = await NotifAPI.list(1);
    window._notifCount = 0;
    updateNotifBadge(0);
    renderNotifDropdown(data.notifications || []);
  } catch (e) {
    document.getElementById('notif-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Failed to load</div>';
  }
}

function renderNotifDropdown(notifications) {
  const list = document.getElementById('notif-list');
  if (!notifications.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3)">No notifications yet</div>';
    return;
  }
  const typeIcons = { reaction: '👍', comment: '💬', friend_request: '👥', friend_accept: '✅', message: '💌', tag: '🏷️', share: '🔁' };
  list.innerHTML = notifications.slice(0, 15).map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id},'${n.type}',${n.entity_id || 0},'${n.entity_type || ''}')">
      <div class="notif-icon-wrap">
        ${n.actor_avatar ? `<img src="${escapeHtml(n.actor_avatar)}" class="avatar md" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : `<div class="avatar md" style="width:44px;height:44px"><div class="avatar-inner md">${(n.actor_name||'?')[0]}</div></div>`}
        <span class="notif-type-icon" style="background:var(--primary)">${typeIcons[n.type] || '🔔'}</span>
      </div>
      <div class="notif-text">
        <p>${escapeHtml(n.message)}</p>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
      ${n.is_read ? '' : '<div class="notif-unread-dot"></div>'}
    </div>
  `).join('');
}

function handleNotifClick(id, type, entityId, entityType) {
  NotifAPI.markRead(id);
  document.getElementById('notification-dropdown').classList.add('hidden');
  if (type === 'message') navigate('messages', { userId: entityId });
  else if (entityType === 'post') navigate('feed');
  else if (entityType === 'user') navigate('profile', { id: entityId });
}

async function markAllRead() {
  await NotifAPI.markAllRead();
  window._notifCount = 0;
  updateNotifBadge(0);
  document.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
  document.querySelectorAll('.notif-unread-dot').forEach(el => el.remove());
}

// ---- Saved Posts ----
async function renderSavedPage(container) {
  container.innerHTML = `<div class="one-col-layout">
    <div class="section-header"><h2>Saved Posts</h2></div>
    <div id="saved-list"><div class="loading-center"><div class="spinner"></div></div></div>
  </div>`;
  try {
    const posts = await PostsAPI.saved();
    const list = document.getElementById('saved-list');
    if (!posts || !posts.length) {
      list.innerHTML = `<div class="empty-state"><h3>No saved posts</h3><p>Posts you save will appear here</p></div>`;
      return;
    }
    list.innerHTML = posts.map(p => renderPostCard(p)).join('');
  } catch (e) {
    document.getElementById('saved-list').innerHTML = '<div class="empty-state"><h3>Failed to load</h3></div>';
  }
}

// ---- Settings ----
function renderSettingsPage(container) {
  container.innerHTML = `
    <div class="three-col-layout" style="grid-template-columns:var(--sidebar-w) 1fr">
      ${renderSidebar(window.currentUser)}
      <main>
        <div class="settings-layout">
          <div class="settings-nav">
            <button class="settings-nav-btn active" onclick="showSettingsSection('account',this)">👤 Account</button>
            <button class="settings-nav-btn" onclick="showSettingsSection('password',this)">🔒 Password</button>
            <button class="settings-nav-btn" onclick="showSettingsSection('privacy',this)">🔐 Privacy</button>
            <button class="settings-nav-btn" onclick="showSettingsSection('notifications',this)">🔔 Notifications</button>
            <button class="settings-nav-btn" onclick="showSettingsSection('blocked',this)">🚫 Blocked Users</button>
            <button class="settings-nav-btn danger" style="color:#e53935" onclick="showSettingsSection('delete',this)">⚠️ Delete Account</button>
          </div>
          <div class="settings-content" id="settings-content">
          </div>
        </div>
      </main>
    </div>
  `;
  showSettingsSection('account', document.querySelector('.settings-nav-btn'));
}

function showSettingsSection(section, btn) {
  document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const content = document.getElementById('settings-content');
  const user = window.currentUser;

  if (section === 'account') {
    content.innerHTML = `
      <div class="settings-section">
        <h3>Account Information</h3>
        <form id="account-form">
          <div class="form-group"><label>Full Name</label><input class="form-input" id="s-name" value="${escapeHtml(user?.name||'')}" /></div>
          <div class="form-group"><label>Username</label><input class="form-input" id="s-username" value="${escapeHtml(user?.username||'')}" /></div>
          <div class="form-group"><label>Bio</label><textarea class="form-input" id="s-bio" rows="3">${escapeHtml(user?.bio||'')}</textarea></div>
          <div class="form-group"><label>Location</label><input class="form-input" id="s-location" value="${escapeHtml(user?.location||'')}" /></div>
          <div class="form-group"><label>Website</label><input class="form-input" id="s-website" value="${escapeHtml(user?.website||'')}" /></div>
          <div class="form-group"><label>Work</label><input class="form-input" id="s-work" value="${escapeHtml(user?.work||'')}" /></div>
          <div class="form-group"><label>Education</label><input class="form-input" id="s-education" value="${escapeHtml(user?.education||'')}" /></div>
          <button type="submit" class="btn-primary" style="width:auto;padding:10px 24px">Save Changes</button>
        </form>
      </div>
    `;
    document.getElementById('account-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const updated = await UsersAPI.update(user.id, {
          name: document.getElementById('s-name').value,
          username: document.getElementById('s-username').value,
          bio: document.getElementById('s-bio').value,
          location: document.getElementById('s-location').value,
          website: document.getElementById('s-website').value,
          work: document.getElementById('s-work').value,
          education: document.getElementById('s-education').value,
        });
        window.currentUser = { ...window.currentUser, ...updated };
        localStorage.setItem('user', JSON.stringify(window.currentUser));
        updateNavAvatar();
        showToast('Profile updated!', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });

  } else if (section === 'password') {
    content.innerHTML = `
      <div class="settings-section">
        <h3>Change Password</h3>
        <form id="pwd-form">
          <div class="form-group"><label>Current Password</label><input type="password" class="form-input" id="s-cur-pwd" /></div>
          <div class="form-group"><label>New Password</label><input type="password" class="form-input" id="s-new-pwd" /></div>
          <div class="form-group"><label>Confirm New Password</label><input type="password" class="form-input" id="s-conf-pwd" /></div>
          <div id="pwd-err" class="form-error"></div>
          <button type="submit" class="btn-primary" style="width:auto;padding:10px 24px">Update Password</button>
        </form>
      </div>
    `;
    document.getElementById('pwd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = document.getElementById('s-cur-pwd').value;
      const nw = document.getElementById('s-new-pwd').value;
      const conf = document.getElementById('s-conf-pwd').value;
      const errEl = document.getElementById('pwd-err');
      if (nw !== conf) { errEl.textContent = 'Passwords do not match'; return; }
      try {
        await AuthAPI.changePassword(cur, nw);
        showToast('Password changed successfully!', 'success');
        document.getElementById('pwd-form').reset();
      } catch (err) { errEl.textContent = err.message; }
    });

  } else if (section === 'privacy') {
    content.innerHTML = `
      <div class="settings-section">
        <h3>Privacy Settings</h3>
        <div class="settings-row">
          <div><div class="label">Profile Visibility</div><div class="description">Who can see your profile</div></div>
          <select class="form-input" style="width:auto" id="s-priv-profile" onchange="savePrivacy()">
            <option value="public" ${user?.privacy_profile==='public'?'selected':''}>Public</option>
            <option value="friends" ${user?.privacy_profile==='friends'?'selected':''}>Friends Only</option>
          </select>
        </div>
        <div class="settings-row">
          <div><div class="label">Post Visibility</div><div class="description">Default audience for your posts</div></div>
          <select class="form-input" style="width:auto" id="s-priv-posts" onchange="savePrivacy()">
            <option value="public" ${user?.privacy_posts==='public'?'selected':''}>Public</option>
            <option value="friends" ${user?.privacy_posts==='friends'?'selected':''}>Friends Only</option>
            <option value="only_me" ${user?.privacy_posts==='only_me'?'selected':''}>Only Me</option>
          </select>
        </div>
        <div class="settings-row">
          <div><div class="label">Who Can Message Me</div></div>
          <select class="form-input" style="width:auto" id="s-priv-msg" onchange="savePrivacy()">
            <option value="everyone" ${user?.privacy_messages==='everyone'?'selected':''}>Everyone</option>
            <option value="friends" ${user?.privacy_messages==='friends'?'selected':''}>Friends Only</option>
          </select>
        </div>
      </div>
    `;

  } else if (section === 'delete') {
    content.innerHTML = `
      <div class="settings-section">
        <h3 style="color:#e53935">Delete Account</h3>
        <p style="color:var(--text2);margin-bottom:16px">This will permanently delete your account and all your data. This action cannot be undone.</p>
        <div class="form-group"><label>Enter your password to confirm</label><input type="password" class="form-input" id="s-del-pwd" /></div>
        <div id="del-err" class="form-error"></div>
        <button class="btn-danger" onclick="deleteMyAccount()">Delete My Account Permanently</button>
      </div>
    `;

  } else if (section === 'blocked') {
    content.innerHTML = `<div class="settings-section"><h3>Blocked Users</h3><div id="blocked-list"><div class="loading-center"><div class="spinner"></div></div></div></div>`;
    UsersAPI.blockedList().then(list => {
      const el = document.getElementById('blocked-list');
      if (!list || !list.length) { el.innerHTML = '<p style="color:var(--text3)">You haven\'t blocked anyone</p>'; return; }
      el.innerHTML = list.map(u => `
        <div class="settings-row">
          <div class="d-flex align-center gap-8">${avatarEl(u,'sm')}<span style="font-weight:600">${escapeHtml(u.name)}</span></div>
          <button class="btn-secondary btn-sm" onclick="UsersAPI.block(${u.id}).then(()=>showSettingsSection('blocked',document.querySelector('.settings-nav-btn:nth-child(5)')))">Unblock</button>
        </div>
      `).join('');
    });
  }
}

async function savePrivacy() {
  try {
    await UsersAPI.update(window.currentUser.id, {
      privacy_profile: document.getElementById('s-priv-profile')?.value,
      privacy_posts: document.getElementById('s-priv-posts')?.value,
      privacy_messages: document.getElementById('s-priv-msg')?.value,
    });
    showToast('Privacy settings saved', 'success');
  } catch (e) { showToast('Failed to save', 'error'); }
}

async function deleteMyAccount() {
  const pwd = document.getElementById('s-del-pwd')?.value;
  if (!pwd) { document.getElementById('del-err').textContent = 'Password required'; return; }
  showConfirm('Delete Account', 'Are you absolutely sure? This cannot be undone.', async () => {
    try {
      await AuthAPI.deleteAccount(pwd);
      localStorage.clear();
      window.currentUser = null;
      disconnectSocket();
      showAuthPage('login');
    } catch (err) {
      const errEl = document.getElementById('del-err');
      if (errEl) errEl.textContent = err.message;
    }
  });
}
