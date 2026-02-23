// ============================================================
// GROUPS.JS — Groups page
// ============================================================

async function renderGroupsPage(container, params) {
  if (params.id) {
    renderGroupDetail(container, params.id);
    return;
  }

  container.innerHTML = `
    <div class="two-col-layout">
      <main>
        <div class="section-header">
          <h2>Groups</h2>
          <button class="btn-primary btn-sm" onclick="openCreateGroupModal()">+ Create Group</button>
        </div>
        <div class="section-tabs">
          <div class="section-tab active" onclick="switchGroupsTab('discover',this)">Discover</div>
          <div class="section-tab" onclick="switchGroupsTab('my',this)">My Groups</div>
        </div>
        <div id="groups-content">
          <div class="loading-center"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
  loadGroupsTab('discover');
}

async function loadGroupsTab(tab) {
  const content = document.getElementById('groups-content');
  content.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  const groups = await GroupsAPI.list().catch(() => []);
  const uid = window.currentUser?.id;

  let filtered = groups;
  if (tab === 'my') filtered = groups.filter(g => g.my_role !== null);

  if (!filtered.length) {
    content.innerHTML = '<div class="empty-state"><h3>No groups found</h3><p>Create one to get started!</p></div>';
    return;
  }

  content.innerHTML = `<div class="group-grid">
    ${filtered.map(g => `
      <div class="group-card" onclick="navigate('groups',{id:${g.id}})">
        <div class="group-card-cover">
          ${g.cover_photo ? `<img src="${escapeHtml(g.cover_photo)}">` : ''}
        </div>
        <div class="group-card-info">
          <h4>${escapeHtml(g.name)}</h4>
          <p>${g.privacy} · ${g.member_count} member${g.member_count !== 1 ? 's' : ''}</p>
        </div>
        <div class="group-card-footer">
          ${g.my_role ? `<button class="btn-secondary" style="flex:1;padding:7px;font-size:13px;font-weight:600" onclick="event.stopPropagation();leaveGroupFromCard(${g.id})">Leave</button>` : `<button class="btn-primary" style="flex:1;padding:7px;font-size:13px;font-weight:600" onclick="event.stopPropagation();joinGroupFromCard(${g.id},this)">Join</button>`}
          <button class="btn-secondary" style="flex:1;padding:7px;font-size:13px;font-weight:600" onclick="event.stopPropagation();navigate('groups',{id:${g.id}})">View</button>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function switchGroupsTab(tab, el) {
  document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadGroupsTab(tab);
}

async function joinGroupFromCard(groupId, btn) {
  try {
    await GroupsAPI.join(groupId);
    btn.textContent = 'Joined ✓';
    btn.disabled = true;
    btn.className = 'btn-secondary';
    showToast('Joined group!', 'success');
  } catch (e) { showToast(e.message || 'Failed', 'error'); }
}

async function leaveGroupFromCard(groupId) {
  showConfirm('Leave Group', 'Leave this group?', async () => {
    try {
      await GroupsAPI.leave(groupId);
      loadGroupsTab('my');
    } catch (e) { showToast(e.message, 'error'); }
  });
}

async function renderGroupDetail(container, groupId) {
  container.innerHTML = '<div class="loading-center" style="padding:60px"><div class="spinner"></div></div>';
  try {
    const group = await GroupsAPI.get(groupId);
    const posts = await GroupsAPI.posts(groupId);
    const uid = window.currentUser?.id;
    const isMember = group.myRole !== null;
    const isAdmin = group.myRole === 'admin';

    container.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:16px">
        <div class="card" style="margin-bottom:12px;overflow:hidden">
          <div style="height:200px;background:linear-gradient(135deg,var(--primary),var(--accent));overflow:hidden">
            ${group.cover_photo ? `<img src="${escapeHtml(group.cover_photo)}" style="width:100%;height:100%;object-fit:cover">` : ''}
          </div>
          <div style="padding:16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div>
                <h2 style="font-size:24px;font-weight:800">${escapeHtml(group.name)}</h2>
                <p style="color:var(--text3)">${capitalize(group.privacy)} Group · ${group.member_count} members</p>
                ${group.description ? `<p style="margin-top:6px;color:var(--text2)">${escapeHtml(group.description)}</p>` : ''}
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn-secondary btn-sm" onclick="navigate('groups')">‹ Back</button>
                ${isMember ? `<button class="btn-secondary btn-sm" onclick="leaveGroup(${group.id})">Leave Group</button>` : `<button class="btn-primary btn-sm" onclick="joinGroup(${group.id},this)">+ Join Group</button>`}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:2px;padding:0 16px 12px;overflow-x:auto">
            <button class="create-action-btn" onclick="openGroupPostModal(${group.id})">📝 Create Post</button>
            <button class="create-action-btn" onclick="switchGroupTab('members')">👥 Members</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 280px;gap:12px">
          <div>
            ${isMember ? renderGroupCreatePost(group.id) : ''}
            <div id="group-posts-list">
              ${posts.map(p => renderPostCard(p)).join('') || '<div class="empty-state"><h3>No posts yet</h3></div>'}
            </div>
          </div>
          <div>
            <div class="panel-card">
              <h4>Members (${group.members?.length || 0})</h4>
              ${(group.members || []).slice(0, 8).map(m => `
                <div class="contact-item" onclick="navigate('profile',{id:${m.id}})">
                  ${m.avatar ? `<img src="${escapeHtml(m.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : `<div class="avatar sm"><div class="avatar-inner sm">${m.name[0]}</div></div>`}
                  <div>
                    <div style="font-size:14px;font-weight:600">${escapeHtml(m.name)}</div>
                    <div style="font-size:12px;color:var(--text3)">${m.role === 'admin' ? '⭐ Admin' : 'Member'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><h3>Group not found</h3></div>';
  }
}

function renderGroupCreatePost(groupId) {
  const user = window.currentUser;
  const init = (user?.name || '?')[0].toUpperCase();
  const av = user?.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">` : `<div class="avatar md"><div class="avatar-inner md">${init}</div></div>`;
  return `<div class="create-post-card">
    <div class="create-post-top">${av}<button class="create-post-input" onclick="openGroupPostModal(${groupId})">Write something to this group...</button></div>
  </div>`;
}

function openGroupPostModal(groupId) {
  const user = window.currentUser;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Create Group Post</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      <div class="modal-body">
        <textarea class="compose-textarea form-input" id="gpost-content" placeholder="Write something..." style="min-height:100px;margin-bottom:10px"></textarea>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--primary)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          Add Photo/Video
          <input type="file" id="gpost-media" accept="image/*,video/*" multiple style="display:none">
        </label>
        <button class="btn-primary" onclick="submitGroupPost(${groupId},this)">Post to Group</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function submitGroupPost(groupId, btn) {
  const content = document.getElementById('gpost-content')?.value.trim();
  const files = document.getElementById('gpost-media')?.files;
  if (!content && (!files || !files.length)) { showToast('Add content', 'error'); return; }
  const formData = new FormData();
  if (content) formData.append('content', content);
  if (files) Array.from(files).forEach(f => formData.append('media', f));
  btn.disabled = true; btn.textContent = 'Posting...';
  try {
    const post = await GroupsAPI.createPost(groupId, formData);
    btn.closest('.modal-overlay').remove();
    const list = document.getElementById('group-posts-list');
    if (list) list.insertAdjacentHTML('afterbegin', renderPostCard(post));
    showToast('Posted!', 'success');
  } catch (e) { showToast('Failed', 'error'); btn.disabled = false; btn.textContent = 'Post to Group'; }
}

async function joinGroup(groupId, btn) {
  try {
    await GroupsAPI.join(groupId);
    btn.textContent = 'Leave Group';
    btn.className = 'btn-secondary btn-sm';
    btn.onclick = () => leaveGroup(groupId);
    showToast('Joined group!', 'success');
  } catch (e) { showToast(e.message || 'Failed', 'error'); }
}

async function leaveGroup(groupId) {
  showConfirm('Leave Group', 'Are you sure you want to leave this group?', async () => {
    try {
      await GroupsAPI.leave(groupId);
      navigate('groups');
    } catch (e) { showToast(e.message, 'error'); }
  });
}

function openCreateGroupModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Create Group</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      <div class="modal-body">
        <form id="create-group-form">
          <div class="form-group"><label>Group Name *</label><input class="form-input" id="g-name" placeholder="Group name" required></div>
          <div class="form-group"><label>Description</label><textarea class="form-input" id="g-desc" rows="3" placeholder="What is this group about?"></textarea></div>
          <div class="form-group"><label>Privacy</label>
            <select class="form-input" id="g-privacy">
              <option value="public">🌐 Public</option>
              <option value="private">🔒 Private</option>
            </select>
          </div>
          <div class="form-group"><label>Cover Photo</label><input type="file" class="form-input" id="g-cover" accept="image/*"></div>
          <button type="submit" class="btn-primary">Create Group</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('g-name').value);
    formData.append('description', document.getElementById('g-desc').value);
    formData.append('privacy', document.getElementById('g-privacy').value);
    const cover = document.getElementById('g-cover').files[0];
    if (cover) formData.append('cover', cover);
    try {
      const group = await GroupsAPI.create(formData);
      modal.remove();
      navigate('groups', { id: group.id });
      showToast('Group created!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });
}
