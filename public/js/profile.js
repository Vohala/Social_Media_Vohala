// ============================================================
// PROFILE.JS — Profile page, edit, photos, friends tab
// ============================================================

async function renderProfilePage(container, params) {
  const userId = params.id || window.currentUser?.id;
  const isOwnProfile = userId == window.currentUser?.id;

  container.innerHTML = `<div class="one-col-layout" style="max-width:860px;padding-top:0">
    <div class="loading-center" style="padding:60px"><div class="spinner"></div></div>
  </div>`;

  try {
    const user = await UsersAPI.get(userId);
    const friends = await UsersAPI.friends(userId);

    container.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:0 0 24px">
        <!-- Cover & Avatar -->
        <div class="profile-cover">
          ${user.cover_photo ? `<img src="${escapeHtml(user.cover_photo)}" alt="Cover">` : ''}
          <div class="profile-avatar-wrap">
            <div class="profile-avatar">
              ${user.avatar ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}">` : user.name[0].toUpperCase()}
            </div>
            ${isOwnProfile ? `<label class="profile-avatar-edit" style="cursor:pointer" title="Change photo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              <input type="file" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
            </label>` : ''}
          </div>
          ${isOwnProfile ? `<div class="profile-cover-edit">
            <label class="btn-secondary btn-sm" style="cursor:pointer;display:flex;align-items:center;gap:6px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
              Edit Cover
              <input type="file" accept="image/*" style="display:none" onchange="uploadCover(this)">
            </label>
          </div>` : ''}
        </div>

        <!-- Profile Info -->
        <div class="profile-info-row" style="position:relative">
          <div class="profile-name">
            ${escapeHtml(user.name)}
            ${user.is_verified ? '<span class="verified-badge" title="Verified">✓</span>' : ''}
          </div>
          <div class="profile-friends-count">${user.friendCount} friends${user.mutualFriends > 0 ? ` · ${user.mutualFriends} mutual` : ''}</div>
          ${friends.length > 0 ? `
            <div class="profile-friend-avatars">
              ${friends.slice(0, 8).map(f => f.avatar
                ? `<img class="mini-avatar" src="${escapeHtml(f.avatar)}" title="${escapeHtml(f.name)}">`
                : `<div class="mini-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px">${f.name[0]}</div>`
              ).join('')}
            </div>` : ''}
          ${user.bio ? `<div style="margin:8px 0;color:var(--text2)">${escapeHtml(user.bio)}</div>` : ''}

          <div class="profile-actions">
            ${isOwnProfile ? `
              <button class="btn-primary btn-sm" onclick="openEditProfileModal()">✏️ Edit Profile</button>
              <button class="btn-secondary btn-sm" onclick="navigate('settings')">⚙️ Settings</button>
            ` : `
              ${renderFriendButton(user)}
              <button class="btn-secondary btn-sm" onclick="navigate('messages',{userId:${user.id}})">💬 Message</button>
              ${user.isFollowing
                ? `<button class="btn-secondary btn-sm" onclick="toggleFollow(${user.id},this)">✓ Following</button>`
                : `<button class="btn-secondary btn-sm" onclick="toggleFollow(${user.id},this)">+ Follow</button>`}
              <button class="btn-secondary btn-sm" onclick="toggleUserMenu(${user.id})" style="width:36px;text-align:center">···</button>
            `}
          </div>
        </div>

        <!-- Tabs -->
        <div class="profile-tabs" id="profile-tabs-bar">
          <div class="profile-tab active" onclick="switchProfileTab('posts',this,${userId})">Posts</div>
          <div class="profile-tab" onclick="switchProfileTab('about',this,${userId})">About</div>
          <div class="profile-tab" onclick="switchProfileTab('friends',this,${userId})">Friends</div>
          <div class="profile-tab" onclick="switchProfileTab('photos',this,${userId})">Photos</div>
        </div>

        <!-- Tab Content -->
        <div id="profile-tab-content" style="padding:16px">
          <div id="profile-posts-list"><div class="loading-center"><div class="spinner"></div></div></div>
        </div>
      </div>
    `;

    loadProfilePosts(userId);
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><h3>User not found</h3></div>';
  }
}

function renderFriendButton(user) {
  if (user.relationshipStatus === 'friends') {
    return `<button class="btn-secondary btn-sm" onclick="unfriend(${user.id},this)">✓ Friends ▾</button>`;
  } else if (user.relationshipStatus === 'request_sent') {
    return `<button class="btn-secondary btn-sm" onclick="cancelFriendRequest(${user.id},this)">Request Sent ✕</button>`;
  } else if (user.relationshipStatus === 'request_received') {
    return `<button class="btn-primary btn-sm" onclick="acceptFriendRequest(${user.id},this)">Accept Request</button>`;
  } else {
    return `<button class="btn-primary btn-sm" onclick="sendFriendRequest(${user.id},this)">+ Add Friend</button>`;
  }
}

async function sendFriendRequest(uid, btn) {
  try {
    await FriendsAPI.sendRequest(uid);
    btn.textContent = 'Request Sent ✕';
    btn.className = 'btn-secondary btn-sm';
    btn.onclick = () => cancelFriendRequest(uid, btn);
    showToast('Friend request sent!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function cancelFriendRequest(uid, btn) {
  try {
    await FriendsAPI.cancel(uid);
    btn.textContent = '+ Add Friend';
    btn.className = 'btn-primary btn-sm';
    btn.onclick = () => sendFriendRequest(uid, btn);
    showToast('Request cancelled', 'info');
  } catch (e) { showToast(e.message, 'error'); }
}

async function acceptFriendRequest(uid, btn) {
  try {
    await FriendsAPI.accept(uid);
    btn.textContent = '✓ Friends';
    btn.className = 'btn-secondary btn-sm';
    showToast('Friend request accepted!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function unfriend(uid, btn) {
  showConfirm('Unfriend', 'Are you sure you want to unfriend this person?', async () => {
    try {
      await FriendsAPI.unfriend(uid);
      btn.textContent = '+ Add Friend';
      btn.className = 'btn-primary btn-sm';
      btn.onclick = () => sendFriendRequest(uid, btn);
    } catch (e) { showToast(e.message, 'error'); }
  });
}

async function toggleFollow(uid, btn) {
  try {
    const data = await UsersAPI.follow(uid);
    btn.textContent = data.following ? '✓ Following' : '+ Follow';
  } catch (e) { showToast(e.message, 'error'); }
}

async function switchProfileTab(tab, el, userId) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const content = document.getElementById('profile-tab-content');

  if (tab === 'posts') {
    content.innerHTML = '<div id="profile-posts-list"><div class="loading-center"><div class="spinner"></div></div></div>';
    loadProfilePosts(userId);
  } else if (tab === 'about') {
    content.innerHTML = renderAboutTab(await UsersAPI.get(userId));
  } else if (tab === 'friends') {
    content.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    const friends = await UsersAPI.friends(userId);
    content.innerHTML = renderFriendsGrid(friends);
  } else if (tab === 'photos') {
    content.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    const photos = await UsersAPI.photos(userId);
    renderPhotosTab(content, photos);
  }
}

async function loadProfilePosts(userId) {
  const list = document.getElementById('profile-posts-list');
  if (!list) return;
  try {
    const posts = await UsersAPI.posts(userId);
    list.innerHTML = posts && posts.length
      ? posts.map(p => renderPostCard(p)).join('')
      : '<div class="empty-state"><h3>No posts yet</h3></div>';
  } catch (e) { list.innerHTML = '<div class="empty-state"><h3>Failed to load</h3></div>'; }
}

function renderAboutTab(user) {
  const items = [
    user.work ? ['💼', 'Works at', user.work] : null,
    user.education ? ['🎓', 'Studied at', user.education] : null,
    user.location ? ['📍', 'Lives in', user.location] : null,
    user.website ? ['🌐', 'Website', `<a href="${escapeHtml(user.website)}" target="_blank">${escapeHtml(user.website)}</a>`] : null,
    user.relationship_status ? ['❤️', 'Relationship', user.relationship_status] : null,
    user.birthday ? ['🎂', 'Birthday', formatDate(user.birthday)] : null,
    ['📅', 'Joined', formatDate(user.created_at)],
  ].filter(Boolean);

  return `<div class="card">
    <div class="card-body" style="padding:16px">
      <h4 style="margin-bottom:14px;font-size:18px;font-weight:700">About</h4>
      ${items.map(([icon, label, value]) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2)">
          <span style="font-size:18px">${icon}</span>
          <div><div style="font-size:12px;color:var(--text3)">${label}</div><div style="font-weight:500">${typeof value === 'string' ? escapeHtml(value) : value}</div></div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function renderFriendsGrid(friends) {
  if (!friends || !friends.length) return '<div class="empty-state"><h3>No friends yet</h3></div>';
  return `<div class="friends-grid">
    ${friends.map(f => {
      const init = (f.name || '?')[0].toUpperCase();
      return `<div class="friend-card">
        <div class="friend-card-cover">
          <div class="friend-card-avatar">${f.avatar ? `<img src="${escapeHtml(f.avatar)}">` : init}</div>
        </div>
        <div class="friend-card-info">
          <h4>${escapeHtml(f.name)}</h4>
          <p>@${escapeHtml(f.username)}</p>
          <button class="btn-primary" style="width:100%;padding:7px" onclick="navigate('profile',{id:${f.id}})">View Profile</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderPhotosTab(container, photos) {
  if (!photos || !photos.length) {
    container.innerHTML = '<div class="empty-state"><h3>No photos yet</h3></div>';
    return;
  }
  container.innerHTML = `<div class="photo-grid">
    ${photos.map(p => `
      <div class="photo-grid-item" onclick="openLightbox([{url:'${escapeHtml(p.url)}',type:'image'}],0)">
        <img src="${escapeHtml(p.url)}" alt="Photo" loading="lazy">
      </div>
    `).join('')}
  </div>`;
}

// Edit profile modal
function openEditProfileModal() {
  const user = window.currentUser;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Edit Profile</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <form id="edit-profile-form">
          <div class="form-group"><label>Name</label><input class="form-input" id="ep-name" value="${escapeHtml(user?.name||'')}"></div>
          <div class="form-group"><label>Username</label><input class="form-input" id="ep-username" value="${escapeHtml(user?.username||'')}"></div>
          <div class="form-group"><label>Bio</label><textarea class="form-input" id="ep-bio" rows="3">${escapeHtml(user?.bio||'')}</textarea></div>
          <div class="form-group"><label>Location</label><input class="form-input" id="ep-location" value="${escapeHtml(user?.location||'')}"></div>
          <div class="form-group"><label>Work</label><input class="form-input" id="ep-work" value="${escapeHtml(user?.work||'')}"></div>
          <div class="form-group"><label>Education</label><input class="form-input" id="ep-education" value="${escapeHtml(user?.education||'')}"></div>
          <div class="form-group"><label>Website</label><input class="form-input" id="ep-website" value="${escapeHtml(user?.website||'')}"></div>
          <div class="form-group"><label>Relationship Status</label>
            <select class="form-input" id="ep-relationship">
              <option value="">Not specified</option>
              ${['Single','In a relationship','Married','Engaged','It\'s complicated'].map(s => `<option value="${s}" ${user?.relationship_status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div id="edit-profile-error" class="form-error"></div>
          <button type="submit" class="btn-primary">Save Changes</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const updated = await UsersAPI.update(user.id, {
        name: document.getElementById('ep-name').value,
        username: document.getElementById('ep-username').value,
        bio: document.getElementById('ep-bio').value,
        location: document.getElementById('ep-location').value,
        work: document.getElementById('ep-work').value,
        education: document.getElementById('ep-education').value,
        website: document.getElementById('ep-website').value,
        relationship_status: document.getElementById('ep-relationship').value,
      });
      window.currentUser = { ...window.currentUser, ...updated };
      localStorage.setItem('user', JSON.stringify(window.currentUser));
      updateNavAvatar();
      modal.remove();
      navigate('profile', { id: user.id });
      showToast('Profile updated!', 'success');
    } catch (err) {
      document.getElementById('edit-profile-error').textContent = err.message;
    }
  });
}

async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  try {
    const data = await UsersAPI.uploadAvatar(window.currentUser.id, formData);
    window.currentUser.avatar = data.avatar;
    localStorage.setItem('user', JSON.stringify(window.currentUser));
    updateNavAvatar();
    navigate('profile', { id: window.currentUser.id });
    showToast('Profile photo updated!', 'success');
  } catch (e) { showToast('Failed to upload', 'error'); }
}

async function uploadCover(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('cover', file);
  try {
    await UsersAPI.uploadCover(window.currentUser.id, formData);
    navigate('profile', { id: window.currentUser.id });
    showToast('Cover photo updated!', 'success');
  } catch (e) { showToast('Failed to upload', 'error'); }
}
