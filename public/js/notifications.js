// ============================================================
// NOTIFICATIONS.JS — Notification list page
// ============================================================

async function renderNotificationsPage(container) {
  container.innerHTML = `
    <div class="two-col-layout">
      <main>
        <div class="section-header">
          <h2>Notifications</h2>
          <button class="btn-secondary btn-sm" onclick="markAllRead()">Mark all as read</button>
        </div>
        <div class="card" id="notifications-card" style="padding:0;overflow:hidden">
          <div class="loading-center"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;

  try {
    const data = await NotifAPI.list(1);
    const card = document.getElementById('notifications-card');
    window._notifCount = 0;
    updateNotifBadge(0);

    if (!data.notifications || !data.notifications.length) {
      card.innerHTML = '<div class="empty-state" style="padding:48px"><h3>No notifications</h3><p>When someone reacts to your posts, sends requests, or messages you, it will appear here.</p></div>';
      return;
    }

    const typeIcons = { reaction: '👍', comment: '💬', friend_request: '👥', friend_accept: '✅', message: '💌', tag: '🏷️', share: '🔁' };
    const typeBg = { reaction: '#5c35d4', comment: '#31a24c', friend_request: '#ff6b00', friend_accept: '#31a24c', message: '#5c35d4', tag: '#f7b928', share: '#4facfe' };

    card.innerHTML = data.notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id},'${n.type}',${n.entity_id || 0},'${n.entity_type || ''}')">
        <div class="notif-icon-wrap">
          ${n.actor_avatar
            ? `<img src="${escapeHtml(n.actor_avatar)}" style="width:50px;height:50px;border-radius:50%;object-fit:cover">`
            : `<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px">${(n.actor_name||'?')[0]}</div>`}
          <span class="notif-type-icon" style="background:${typeBg[n.type]||'var(--primary)'}">
            ${typeIcons[n.type] || '🔔'}
          </span>
        </div>
        <div class="notif-text">
          <p>${escapeHtml(n.message)}</p>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
        ${n.is_read ? '' : '<div class="notif-unread-dot"></div>'}
      </div>
    `).join('');

    // Mark all as read after viewing
    await NotifAPI.markAllRead();
  } catch (e) {
    document.getElementById('notifications-card').innerHTML = '<div class="empty-state"><h3>Failed to load</h3></div>';
  }
}
