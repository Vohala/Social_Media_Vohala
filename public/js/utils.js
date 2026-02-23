// ============================================================
// UTILS.JS — Shared utilities
// ============================================================

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: diff > 31536000 ? 'numeric' : undefined });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function parseContent(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  // Hashtags
  escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, '<span class="post-hashtag" onclick="navigate(\'search\',{q:\'#$1\'})">#$1</span>');
  // Mentions
  escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<span class="post-mention" onclick="navigate(\'search\',{q:\'@$1\'})">@$1</span>');
  // URLs
  escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return escaped;
}

function avatarEl(user, size = 'md') {
  if (!user) return `<div class="avatar ${size} avatar-inner ${size}">?</div>`;
  const initial = (user.name || user.username || '?')[0].toUpperCase();
  if (user.avatar) {
    return `<img class="avatar ${size}" src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}" onerror="this.onerror=null;this.outerHTML='<div class=\\"avatar ${size} avatar-inner ${size}\\">${initial}</div>'" />`;
  }
  return `<div class="avatar ${size}"><div class="avatar-inner ${size}">${initial}</div></div>`;
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');

  // Limit to 5 stacked toasts — remove the oldest if needed
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= 5) existing[0].remove();

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Dismiss">✕</button>
    </div>
    <div class="toast-progress"><div class="toast-progress-fill"></div></div>
  `;
  container.appendChild(toast);

  // Animate the progress bar countdown
  const fill = toast.querySelector('.toast-progress-fill');
  fill.style.transitionDuration = `${duration}ms`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fill.style.width = '0%';
  }));

  const dismiss = () => {
    clearTimeout(timer);
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 300);
  };

  const timer = setTimeout(dismiss, duration);
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  toast.addEventListener('mouseenter', () => { fill.style.animationPlayState = 'paused'; clearTimeout(timer); });
  toast.addEventListener('mouseleave', () => dismiss());
}

function showConfirm(title, message, onOk) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  dialog.classList.remove('hidden');
  const ok = document.getElementById('confirm-ok');
  const cancel = document.getElementById('confirm-cancel');
  const close = () => dialog.classList.add('hidden');
  ok.onclick = () => { close(); onOk(); };
  cancel.onclick = close;
}

// Lightbox state
window._lightboxItems = [];
window._lightboxIndex = 0;

function openLightbox(items, index = 0) {
  window._lightboxItems = items;
  window._lightboxIndex = index;
  renderLightbox();
  document.getElementById('lightbox').classList.remove('hidden');
  document.addEventListener('keydown', lightboxKeyHandler);
}

function renderLightbox() {
  const item = window._lightboxItems[window._lightboxIndex];
  const img = document.getElementById('lightbox-img');
  const video = document.getElementById('lightbox-video');
  if (item.type === 'video') {
    img.style.display = 'none';
    video.style.display = 'block';
    video.src = item.url;
  } else {
    video.style.display = 'none';
    video.src = '';
    img.style.display = 'block';
    img.src = item.url;
  }
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  prevBtn.style.display = window._lightboxItems.length > 1 && window._lightboxIndex > 0 ? 'flex' : 'none';
  nextBtn.style.display = window._lightboxItems.length > 1 && window._lightboxIndex < window._lightboxItems.length - 1 ? 'flex' : 'none';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-video').src = '';
  document.removeEventListener('keydown', lightboxKeyHandler);
}

function lightboxNav(dir) {
  const next = window._lightboxIndex + dir;
  if (next >= 0 && next < window._lightboxItems.length) {
    window._lightboxIndex = next;
    renderLightbox();
  }
}

function lightboxKeyHandler(e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
}

// Generic skeleton post HTML
function skeletonPost() {
  return `<div class="skeleton-post">
    <div class="d-flex align-center gap-8 mb-0" style="margin-bottom:10px">
      <div class="skeleton skeleton-avatar"></div>
      <div style="flex:1">
        <div class="skeleton skeleton-line" style="width:40%;margin-bottom:6px"></div>
        <div class="skeleton skeleton-line" style="width:25%"></div>
      </div>
    </div>
    <div class="skeleton skeleton-line" style="width:90%"></div>
    <div class="skeleton skeleton-line" style="width:70%"></div>
    <div class="skeleton skeleton-media mt-8"></div>
  </div>`;
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('#notification-dropdown') && !e.target.closest('#btn-notifications')) {
    document.getElementById('notification-dropdown')?.classList.add('hidden');
  }
  if (!e.target.closest('#profile-menu') && !e.target.closest('#btn-profile-menu')) {
    document.getElementById('profile-menu')?.classList.add('hidden');
  }
  if (!e.target.closest('#search-bar')) {
    document.getElementById('search-dropdown')?.classList.add('hidden');
  }
  // Close reaction pickers
  document.querySelectorAll('.reaction-picker').forEach(el => {
    if (!el.closest('.reaction-picker-wrap')?.matches(':hover')) {
      // Let CSS handle this via hover
    }
  });
});
