// ============================================================
// FRIENDS.JS — Friends page, requests, suggestions
// ============================================================

async function renderFriendsPage(container) {
  container.innerHTML = `
    <div class="two-col-layout">
      <main>
        <div class="section-tabs" id="friends-tabs">
          <div class="section-tab active" onclick="switchFriendsTab('requests',this)">Friend Requests</div>
          <div class="section-tab" onclick="switchFriendsTab('suggestions',this)">People You May Know</div>
          <div class="section-tab" onclick="switchFriendsTab('all',this)">All Friends</div>
        </div>
        <div id="friends-content">
          <div class="loading-center"><div class="spinner"></div></div>
        </div>
      </main>
      <div class="right-panel" id="friends-right"></div>
    </div>
  `;
  loadFriendsTab('requests');
}

async function switchFriendsTab(tab, el) {
  document.querySelectorAll('#friends-tabs .section-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadFriendsTab(tab);
}

async function loadFriendsTab(tab) {
  const content = document.getElementById('friends-content');
  content.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  if (tab === 'requests') {
    const requests = await FriendsAPI.requests().catch(() => []);
    if (!requests.length) {
      content.innerHTML = '<div class="empty-state"><h3>No friend requests</h3><p>When someone sends you a friend request, it will appear here</p></div>';
      return;
    }
    updateFriendBadge(requests.length);
    content.innerHTML = `<div class="friends-grid">
      ${requests.map(r => `
        <div class="friend-card" id="req-${r.user_id}">
          <div class="friend-card-cover">
            <div class="friend-card-avatar">${r.avatar ? `<img src="${escapeHtml(r.avatar)}">` : r.name[0].toUpperCase()}</div>
          </div>
          <div class="friend-card-info">
            <h4>${escapeHtml(r.name)}</h4>
            <p>${r.mutual_friends > 0 ? `${r.mutual_friends} mutual friends` : `@${escapeHtml(r.username)}`}</p>
            <div class="friend-card-actions">
              <button class="btn-primary" onclick="acceptFriendReq(${r.user_id},this)">Confirm</button>
              <button class="btn-secondary" onclick="rejectFriendReq(${r.user_id},this)">Delete</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;

  } else if (tab === 'suggestions') {
    const suggestions = await FriendsAPI.suggestions().catch(() => []);
    if (!suggestions.length) {
      content.innerHTML = '<div class="empty-state"><h3>No suggestions</h3><p>We\'ll suggest friends as you connect with more people</p></div>';
      return;
    }
    content.innerHTML = `<div class="friends-grid">
      ${suggestions.map(s => `
        <div class="friend-card" id="sug-${s.id}">
          <div class="friend-card-cover">
            <div class="friend-card-avatar">${s.avatar ? `<img src="${escapeHtml(s.avatar)}">` : s.name[0].toUpperCase()}</div>
          </div>
          <div class="friend-card-info">
            <h4>${escapeHtml(s.name)}</h4>
            <p>${s.mutual_friends > 0 ? `${s.mutual_friends} mutual friends` : (s.location || `@${escapeHtml(s.username)}`)}</p>
            <div class="friend-card-actions">
              <button class="btn-primary" onclick="sendFriendRequestFromPage(${s.id},this)">Add Friend</button>
              <button class="btn-secondary" onclick="document.getElementById('sug-${s.id}').remove()">Remove</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;

  } else if (tab === 'all') {
    const friends = await FriendsAPI.list().catch(() => []);
    if (!friends.length) {
      content.innerHTML = '<div class="empty-state"><h3>No friends yet</h3><p>Add friends to see them here</p></div>';
      return;
    }
    content.innerHTML = `<div class="friends-grid">
      ${friends.map(f => `
        <div class="friend-card">
          <div class="friend-card-cover">
            <div class="friend-card-avatar">${f.avatar ? `<img src="${escapeHtml(f.avatar)}">` : f.name[0].toUpperCase()}</div>
          </div>
          <div class="friend-card-info">
            <h4>${escapeHtml(f.name)}</h4>
            <p class="${f.is_online ? 'text-primary' : 'text-muted'}">${f.is_online ? '● Active now' : 'Offline'}</p>
            <div class="friend-card-actions">
              <button class="btn-primary" onclick="navigate('messages',{userId:${f.id}})">Message</button>
              <button class="btn-secondary" onclick="navigate('profile',{id:${f.id}})">Profile</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;
  }
}

async function acceptFriendReq(uid, btn) {
  try {
    await FriendsAPI.accept(uid);
    document.getElementById(`req-${uid}`)?.remove();
    showToast('Friend request accepted!', 'success');
    const remaining = document.querySelectorAll('[id^="req-"]').length;
    updateFriendBadge(remaining);
    if (!remaining) {
      document.getElementById('friends-content').innerHTML = '<div class="empty-state"><h3>No friend requests</h3></div>';
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function rejectFriendReq(uid, btn) {
  try {
    await FriendsAPI.reject(uid);
    document.getElementById(`req-${uid}`)?.remove();
    const remaining = document.querySelectorAll('[id^="req-"]').length;
    updateFriendBadge(remaining);
  } catch (e) {}
}

async function sendFriendRequestFromPage(uid, btn) {
  try {
    await FriendsAPI.sendRequest(uid);
    btn.textContent = 'Request Sent';
    btn.disabled = true;
    btn.className = 'btn-secondary';
    showToast('Friend request sent!', 'success');
  } catch (e) { showToast(e.message || 'Failed', 'error'); }
}
