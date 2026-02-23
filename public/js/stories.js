// ============================================================
// STORIES.JS — Story creator + viewer
// ============================================================

let storyViewerGroups = [];
let storyGroupIndex = 0;
let storyIndex = 0;
let storyTimer = null;
const STORY_DURATION = 5000; // 5 seconds per story

async function renderStoriesPage(container) {
  container.innerHTML = `
    <div class="one-col-layout">
      <div class="section-header">
        <h2>Stories</h2>
        <button class="btn-primary btn-sm" onclick="openCreateStoryModal()">+ Create Story</button>
      </div>
      <div id="stories-grid" class="loading-center"><div class="spinner"></div></div>
    </div>
  `;
  try {
    const groups = await StoriesAPI.list();
    renderStoriesGrid(groups || []);
  } catch (e) {}
}

function renderStoriesGrid(groups) {
  const grid = document.getElementById('stories-grid');
  if (!grid) return;
  if (!groups.length) {
    grid.innerHTML = '<div class="empty-state"><h3>No stories</h3><p>Be the first to share a story!</p></div>';
    return;
  }
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;';
  grid.innerHTML = groups.map(g => {
    const init = (g.name || '?')[0].toUpperCase();
    const firstStory = g.stories[0];
    let bgStyle = '';
    let contentHtml = '';
    if (firstStory.story_type === 'text') {
      bgStyle = `background:${firstStory.bg_color || '#667eea'}`;
      contentHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:12px"><p style="color:white;font-weight:600;text-align:center;font-size:14px">${escapeHtml(firstStory.content)}</p></div>`;
    } else if (firstStory.media_url) {
      contentHtml = `<img src="${escapeHtml(firstStory.media_url)}" style="width:100%;height:100%;object-fit:cover">`;
    }
    return `
      <div class="story-card ${g.allViewed ? 'story-viewed' : ''}" ${bgStyle ? `style="${bgStyle}"` : ''} onclick="openStoryViewer(${g.user_id})">
        <div class="story-user-ring">
          ${g.avatar ? `<img src="${escapeHtml(g.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : `<div class="story-user-ring-inner">${init}</div>`}
        </div>
        ${contentHtml}
        <div class="story-card-name">${escapeHtml(g.name)}</div>
      </div>
    `;
  }).join('');
}

async function openStoryViewer(userId) {
  try {
    const allGroups = await StoriesAPI.list();
    storyViewerGroups = allGroups || [];
    storyGroupIndex = storyViewerGroups.findIndex(g => g.user_id === userId);
    if (storyGroupIndex < 0) storyGroupIndex = 0;
    storyIndex = 0;

    document.getElementById('story-viewer').classList.remove('hidden');
    renderCurrentStory();
  } catch (e) {}
}

function renderCurrentStory() {
  if (storyGroupIndex >= storyViewerGroups.length) { closeStoryViewer(); return; }
  const group = storyViewerGroups[storyGroupIndex];
  if (!group || storyIndex >= group.stories.length) { closeStoryViewer(); return; }
  const story = group.stories[storyIndex];

  // Progress bars
  const progressContainer = document.getElementById('story-progress-bars');
  progressContainer.innerHTML = group.stories.map((s, i) => `
    <div class="story-progress-bar ${i < storyIndex ? 'done' : ''}" id="progress-bar-${i}">
      <div class="story-progress-bar-fill" id="progress-fill-${i}" style="width:${i < storyIndex ? '100%' : '0%'}"></div>
    </div>
  `).join('');

  // User info
  const init = (group.name || '?')[0].toUpperCase();
  document.getElementById('story-user-info').innerHTML = `
    ${group.avatar ? `<img src="${escapeHtml(group.avatar)}" class="avatar" style="width:40px;height:40px;border-radius:50%;border:2px solid white;object-fit:cover">` : `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">${init}</div>`}
    <div>
      <div class="name">${escapeHtml(group.name)}</div>
      <div class="time">${timeAgo(story.created_at)}</div>
    </div>
  `;

  // Story body
  const body = document.getElementById('story-body');
  const viewer = document.getElementById('story-viewer');
  if (story.story_type === 'text') {
    viewer.style.background = story.bg_color || '#667eea';
    body.innerHTML = `<div class="text-story"><p>${escapeHtml(story.content)}</p></div>`;
  } else if (story.media_url) {
    viewer.style.background = '#000';
    const isVideo = story.story_type === 'video';
    body.innerHTML = isVideo
      ? `<video src="${escapeHtml(story.media_url)}" autoplay muted style="max-width:100%;max-height:100%;border-radius:0"></video>`
      : `<img src="${escapeHtml(story.media_url)}" alt="Story" style="max-width:100%;max-height:100%;object-fit:contain">`;
  } else {
    body.innerHTML = `<div class="text-story" style="background:${story.bg_color||'#667eea'}"><p>${escapeHtml(story.content)}</p></div>`;
  }

  // Mark as viewed
  StoriesAPI.view(story.id);

  // Start progress animation
  clearTimeout(storyTimer);
  const fillEl = document.getElementById(`progress-fill-${storyIndex}`);
  if (fillEl) {
    fillEl.style.transition = 'none';
    fillEl.style.width = '0%';
    setTimeout(() => {
      fillEl.style.transition = `width ${STORY_DURATION}ms linear`;
      fillEl.style.width = '100%';
    }, 50);
  }

  storyTimer = setTimeout(() => nextStory(), STORY_DURATION);
}

function nextStory() {
  clearTimeout(storyTimer);
  const group = storyViewerGroups[storyGroupIndex];
  if (!group) { closeStoryViewer(); return; }
  storyIndex++;
  if (storyIndex >= group.stories.length) {
    storyGroupIndex++;
    storyIndex = 0;
    if (storyGroupIndex >= storyViewerGroups.length) { closeStoryViewer(); return; }
  }
  renderCurrentStory();
}

function prevStory() {
  clearTimeout(storyTimer);
  if (storyIndex > 0) {
    storyIndex--;
  } else if (storyGroupIndex > 0) {
    storyGroupIndex--;
    storyIndex = storyViewerGroups[storyGroupIndex].stories.length - 1;
  }
  renderCurrentStory();
}

function closeStoryViewer() {
  clearTimeout(storyTimer);
  document.getElementById('story-viewer').classList.add('hidden');
  document.getElementById('story-viewer').style.background = '';
  storyViewerGroups = [];
  storyGroupIndex = 0;
  storyIndex = 0;
}

// Create Story Modal
function openCreateStoryModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'create-story-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Create Story</h3>
        <button class="modal-close" onclick="document.getElementById('create-story-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div onclick="selectStoryType('text',this)" class="section-tab active" style="padding:16px;cursor:pointer;border-radius:8px;text-align:center;background:var(--bg-hover)">
            <div style="font-size:28px;margin-bottom:4px">✏️</div>
            <div style="font-weight:600">Text Story</div>
          </div>
          <div onclick="selectStoryType('photo',this)" class="section-tab" style="padding:16px;cursor:pointer;border-radius:8px;text-align:center">
            <div style="font-size:28px;margin-bottom:4px">📷</div>
            <div style="font-weight:600">Photo/Video</div>
          </div>
        </div>

        <div id="story-type-text">
          <div class="form-group">
            <label>Your Story Text</label>
            <textarea class="form-input" id="story-text-content" rows="4" placeholder="What's on your mind?"></textarea>
          </div>
          <div class="form-group">
            <label>Background Color</label>
            <div class="bg-color-picker">
              ${BG_COLORS.map(c => `<div class="bg-swatch selected" style="background:${c};cursor:pointer" onclick="document.getElementById('story-bg-color').value='${c}';this.parentElement.querySelectorAll('.bg-swatch').forEach(s=>s.style.outline='');this.style.outline='3px solid var(--text)'"></div>`).join('')}
            </div>
            <input type="hidden" id="story-bg-color" value="${BG_COLORS[0]}">
          </div>
        </div>

        <div id="story-type-photo" style="display:none">
          <div class="form-group">
            <label>Select Photo or Video</label>
            <input type="file" class="form-input" id="story-media-file" accept="image/*,video/*">
          </div>
          <div class="form-group">
            <label>Caption (optional)</label>
            <input class="form-input" id="story-caption" placeholder="Add a caption...">
          </div>
        </div>

        <button class="btn-primary" onclick="submitStory()">Share Story</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function selectStoryType(type, el) {
  document.querySelectorAll('#create-story-modal .section-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('story-type-text').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('story-type-photo').style.display = type === 'photo' ? 'block' : 'none';
}

async function submitStory() {
  const formData = new FormData();
  const hasPhoto = document.getElementById('story-type-photo').style.display !== 'none';

  if (hasPhoto) {
    const file = document.getElementById('story-media-file')?.files[0];
    if (!file) { showToast('Please select a photo or video', 'error'); return; }
    formData.append('media', file);
    formData.append('story_type', file.type.startsWith('video') ? 'video' : 'image');
    formData.append('caption', document.getElementById('story-caption')?.value || '');
  } else {
    const content = document.getElementById('story-text-content')?.value.trim();
    if (!content) { showToast('Please add some text', 'error'); return; }
    formData.append('story_type', 'text');
    formData.append('content', content);
    formData.append('bg_color', document.getElementById('story-bg-color')?.value || '#667eea');
  }

  try {
    await StoriesAPI.create(formData);
    document.getElementById('create-story-modal')?.remove();
    showToast('Story shared! 🎉', 'success');
    // Refresh stories row if on feed
    loadStories();
  } catch (e) { showToast('Failed to create story', 'error'); }
}
