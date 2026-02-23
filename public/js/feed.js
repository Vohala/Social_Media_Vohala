// ============================================================
// FEED.JS — Feed, create post, reactions, comments
// ============================================================

const REACTION_EMOJIS = { like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😡' };
const BG_COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fd746c', '#a18cd1', '#ffecd2'];

let feedPage = 1;
let feedLoading = false;
let feedHasMore = true;

async function renderFeedPage(container, params) {
  feedPage = 1; feedHasMore = true;
  container.innerHTML = `
    <div class="three-col-layout">
      ${renderSidebar(window.currentUser)}
      <main id="feed-main">
        <div id="stories-container"></div>
        <div id="create-post-container"></div>
        <div id="posts-container">
          ${skeletonPost()}${skeletonPost()}${skeletonPost()}
        </div>
        <div id="load-more-wrap"></div>
      </main>
      <div id="right-panel-wrap"></div>
    </div>
  `;

  loadStories();
  renderCreatePost();
  loadFeed(true);
  loadRightPanel();
}

async function loadStories() {
  try {
    const groups = await StoriesAPI.list();
    const container = document.getElementById('stories-container');
    if (!container) return;
    container.innerHTML = renderStoriesRow(groups || []);
  } catch (e) {}
}

function renderStoriesRow(groups) {
  const user = window.currentUser;
  const init = (user?.name || '?')[0].toUpperCase();
  const av = user?.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : `<div class="story-user-ring-inner">${init}</div>`;
  return `
    <div class="card" style="padding:12px">
      <div class="stories-row">
        <div class="story-card story-add-card" onclick="openCreateStoryModal()">
          <div style="width:100%;height:130px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px">
            <div class="story-user-ring">${av}</div>
          </div>
          <div class="add-icon" style="margin-top:6px">+</div>
          <p>Create Story</p>
        </div>
        ${groups.map(g => {
          const firstStory = g.stories[0];
          const viewed = g.allViewed;
          const storyInit = (g.name || '?')[0].toUpperCase();
          const storyAv = g.avatar ? `<img src="${escapeHtml(g.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : `<div class="story-user-ring-inner">${storyInit}</div>`;
          let bgStyle = '';
          let contentHtml = '';
          if (firstStory.story_type === 'text') {
            bgStyle = `background:${firstStory.bg_color||'#667eea'}`;
            contentHtml = `<div class="story-card-text"><p>${escapeHtml(firstStory.content)}</p></div>`;
          } else if (firstStory.media_url) {
            contentHtml = `<img src="${escapeHtml(firstStory.media_url)}" alt="Story" style="width:100%;height:100%;object-fit:cover">`;
          }
          return `
            <div class="story-card ${viewed ? 'story-viewed' : ''}" ${bgStyle ? `style="${bgStyle}"` : ''} onclick="openStoryViewer(${g.user_id})">
              <div class="story-user-ring">${storyAv}</div>
              ${contentHtml}
              <div class="story-card-name">${escapeHtml(g.name)}</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCreatePost() {
  const container = document.getElementById('create-post-container');
  if (!container) return;
  const user = window.currentUser;
  const init = (user?.name || '?')[0].toUpperCase();
  const av = user?.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="navigate('profile',{id:${user.id}})">` : `<div class="avatar md"><div class="avatar-inner md" style="cursor:pointer" onclick="navigate('profile',{id:${user?.id}})">${init}</div></div>`;

  container.innerHTML = `
    <div class="create-post-card">
      <div class="create-post-top">
        ${av}
        <button class="create-post-input" onclick="openCreatePostModal()">What's on your mind, ${escapeHtml(user?.name?.split(' ')[0] || '')}?</button>
      </div>
      <div class="create-post-actions">
        <button class="create-action-btn" onclick="openCreatePostModal('photo')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#45bd62"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          Photo/Video
        </button>
        <button class="create-action-btn" onclick="openCreatePostModal('feeling')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#f7b928"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
          Feeling/Activity
        </button>
        <button class="create-action-btn" onclick="openCreatePostModal('location')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#f5533d"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          Check In
        </button>
      </div>
    </div>
  `;
}

async function loadFeed(reset = false) {
  if (feedLoading) return;
  feedLoading = true;
  if (reset) { feedPage = 1; feedHasMore = true; }

  try {
    const posts = await PostsAPI.feed(feedPage);
    const container = document.getElementById('posts-container');
    if (!container) return;

    if (reset) container.innerHTML = '';
    if (!posts || !posts.length) {
      feedHasMore = false;
      if (reset) container.innerHTML = `<div class="empty-state"><h3>No posts yet</h3><p>Follow some people or make your first post!</p></div>`;
      document.getElementById('load-more-wrap').innerHTML = '';
      return;
    }
    container.insertAdjacentHTML('beforeend', posts.map(p => renderPostCard(p)).join(''));
    feedPage++;
    if (posts.length < 10) {
      feedHasMore = false;
      document.getElementById('load-more-wrap').innerHTML = '';
    } else {
      document.getElementById('load-more-wrap').innerHTML = `<button class="load-more-btn" onclick="loadFeed()">Load more posts</button>`;
    }
  } catch (e) {
    document.getElementById('posts-container').innerHTML = '<div class="empty-state"><h3>Failed to load feed</h3></div>';
  } finally {
    feedLoading = false;
  }
}

async function loadRightPanel() {
  try {
    const friends = await FriendsAPI.list();
    const wrap = document.getElementById('right-panel-wrap');
    if (wrap) wrap.innerHTML = renderRightPanel(friends);
  } catch (e) {}
}

function renderPostCard(post) {
  const user = window.currentUser;
  const author = post.author || {};
  const isOwn = author.id === user?.id;
  const reactionCount = post.totalReactions || 0;
  const commentCount = post.commentCount || 0;
  const init = (author.name || '?')[0].toUpperCase();
  const av = author.avatar ? `<img src="${escapeHtml(author.avatar)}" class="avatar md" style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="navigate('profile',{id:${author.id}})">` : `<div class="avatar md"><div class="avatar-inner md" style="cursor:pointer" onclick="navigate('profile',{id:${author.id}})">${init}</div></div>`;

  const privacyIcons = { public: '🌐', friends: '👥', only_me: '🔒' };
  const feelingHtml = post.feeling ? `<span style="color:var(--text3);font-size:13px"> — feeling ${post.feeling_emoji || ''} ${escapeHtml(post.feeling)}</span>` : '';
  const locationHtml = post.location ? `<span style="color:var(--text3);font-size:13px"> 📍 ${escapeHtml(post.location)}</span>` : '';

  const topReactions = (post.reactions || []).sort((a, b) => b.count - a.count).slice(0, 3);
  const reactionPills = topReactions.map(r => `<span class="reaction-pill">${REACTION_EMOJIS[r.reaction_type] || '👍'}</span>`).join('');
  const userReaction = post.userReaction;
  const likeLabel = userReaction ? (REACTION_EMOJIS[userReaction] + ' ' + capitalize(userReaction)) : '👍 Like';
  const likeClass = userReaction ? `action-btn ${userReaction === 'love' ? 'loved' : 'liked'}` : 'action-btn';

  const mediaHtml = renderMediaGrid(post.media || [], post.id);
  const sharedPostHtml = post.sharedPost ? renderSharedPost(post.sharedPost) : '';
  const contentStyle = post.bg_color && !post.media?.length ? `post-bg" style="background:${escapeHtml(post.bg_color)};color:white;border-radius:8px;margin:0 14px 10px` : '';

  return `
    <div class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-author">
          ${av}
          <div class="post-author-info">
            <h4>
              <a onclick="navigate('profile',{id:${author.id}})">${escapeHtml(author.name)}</a>
              ${author.is_verified ? '<span class="verified-badge" title="Verified">✓</span>' : ''}
              ${feelingHtml}${locationHtml}
            </h4>
            <div class="post-meta">
              <span>${timeAgo(post.created_at)}</span>
              <span>·</span>
              <span class="privacy-icon">${privacyIcons[post.privacy] || '🌐'}</span>
              ${post.updated_at !== post.created_at ? '<span>· Edited</span>' : ''}
            </div>
          </div>
        </div>
        <div style="position:relative">
          <button class="post-menu-btn" onclick="togglePostMenu(${post.id},this)">···</button>
          <div id="post-menu-${post.id}" class="post-dropdown hidden">
            ${isOwn ? `
              <button onclick="openEditPostModal(${post.id}); closePostMenu(${post.id})">✏️ Edit Post</button>
              <button onclick="confirmDeletePost(${post.id}); closePostMenu(${post.id})" class="danger">🗑️ Delete Post</button>
            ` : `
              <button onclick="savePost(${post.id}); closePostMenu(${post.id})">${post.saved ? '🔖 Unsave Post' : '🔖 Save Post'}</button>
              <button onclick="navigate('profile',{id:${author.id}}); closePostMenu(${post.id})">👤 View Profile</button>
            `}
            <button onclick="copyPostLink(${post.id}); closePostMenu(${post.id})">🔗 Copy Link</button>
          </div>
        </div>
      </div>

      ${post.content ? `
        <div class="post-content">
          ${contentStyle ? `<div class="${contentStyle}">` : ''}
          <div class="post-text ${post.bg_color && !post.media?.length ? 'large-text' : ''}">${parseContent(post.content)}</div>
          ${contentStyle ? '</div>' : ''}
        </div>
      ` : ''}

      ${mediaHtml}
      ${sharedPostHtml}

      ${reactionCount || commentCount || post.share_count ? `
        <div class="post-stats">
          ${reactionCount ? `<div class="reaction-pills" onclick="showReactionsModal(${post.id})">${reactionPills}<span class="reaction-count">${reactionCount}</span></div>` : '<div></div>'}
          <div style="display:flex;gap:12px">
            ${commentCount ? `<span style="cursor:pointer" onclick="toggleComments(${post.id})">${commentCount} comment${commentCount !== 1 ? 's' : ''}</span>` : ''}
            ${post.share_count ? `<span>${post.share_count} share${post.share_count !== 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>` : ''}

      <div class="post-actions">
        <div class="reaction-picker-wrap" style="flex:1">
          <button class="${likeClass}" id="like-btn-${post.id}" onclick="toggleReactionPicker(${post.id},event)">
            ${likeLabel}
          </button>
          <div class="reaction-picker" id="reaction-picker-${post.id}">
            ${Object.entries(REACTION_EMOJIS).map(([type, emoji]) => `
              <span class="react-emoji" title="${capitalize(type)}" onclick="selectReaction(${post.id},'${type}')">${emoji}</span>
            `).join('')}
          </div>
        </div>
        <button class="action-btn" style="flex:1" onclick="toggleComments(${post.id})">💬 Comment</button>
        <button class="action-btn" style="flex:1" onclick="openShareModal(${post.id})">↗ Share</button>
        <button class="action-btn" style="flex:1" onclick="savePost(${post.id})" id="save-btn-${post.id}">${post.saved ? '🔖' : '🔖'} ${post.saved ? 'Saved' : 'Save'}</button>
      </div>

      <div id="comments-section-${post.id}" style="display:none">
        <div class="comments-section" id="comments-list-${post.id}"></div>
        <div class="comments-section">
          <div class="comment-input-row">
            ${user?.avatar ? `<img src="${escapeHtml(user.avatar)}" class="avatar sm" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div class="avatar sm"><div class="avatar-inner sm">${init}</div></div>`}
            <div class="comment-input-box">
              <textarea id="comment-input-${post.id}" placeholder="Write a comment..." rows="1" style="overflow:hidden"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitComment(${post.id})}"></textarea>
              <button onclick="submitComment(${post.id})" style="color:var(--primary);font-weight:700;font-size:14px">Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMediaGrid(media, postId) {
  if (!media || !media.length) return '';
  const count = media.length;
  const gridClass = count === 1 ? 'one' : count === 2 ? 'two' : count === 3 ? 'three' : count === 4 ? 'four' : 'more';
  const showCount = Math.min(count, 5);
  const items = media.slice(0, showCount);

  return `<div class="media-grid ${gridClass}">
    ${items.map((m, i) => {
      const isVideo = m.media_type === 'video';
      const isLast = i === showCount - 1 && count > showCount;
      const clickHandler = `openLightbox(${JSON.stringify(media.map(x => ({ url: x.url, type: x.media_type || 'image' })))},${i})`;
      return `<div class="media-item" onclick="${clickHandler}">
        ${isVideo ? `<video src="${escapeHtml(m.url)}" style="width:100%;height:100%;object-fit:cover" muted></video><div class="play-overlay"><svg width="48" height="48" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M8 5v14l11-7z"/></svg></div>` : `<img src="${escapeHtml(m.url)}" alt="" loading="lazy">`}
        ${isLast ? `<div class="media-more-overlay">+${count - showCount}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function renderSharedPost(post) {
  if (!post) return '';
  const author = post.author || {};
  const init = (author.name || '?')[0].toUpperCase();
  const av = author.avatar ? `<img src="${escapeHtml(author.avatar)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px">${init}</div>`;
  return `<div class="shared-post-wrap">
    <div class="shared-post-header">
      ${av}
      <div>
        <div style="font-weight:700;font-size:13px">${escapeHtml(author.name)}</div>
        <div style="font-size:11px;color:var(--text3)">${timeAgo(post.created_at)}</div>
      </div>
    </div>
    <div class="shared-post-content">${parseContent(post.content)}</div>
    ${(post.media||[]).length ? `<img src="${escapeHtml(post.media[0].url)}" style="width:100%;max-height:200px;object-fit:cover">` : ''}
  </div>`;
}

function togglePostMenu(postId, btn) {
  const menu = document.getElementById(`post-menu-${postId}`);
  document.querySelectorAll('.post-dropdown').forEach(m => { if (m.id !== `post-menu-${postId}`) m.classList.add('hidden'); });
  menu.classList.toggle('hidden');
}

function closePostMenu(postId) {
  document.getElementById(`post-menu-${postId}`)?.classList.add('hidden');
}

function toggleReactionPicker(postId, event) {
  if (event) event.stopPropagation();
  const picker = document.getElementById(`reaction-picker-${postId}`);
  if (!picker) return;
  const isOpen = picker.classList.contains('open');
  document.querySelectorAll('.reaction-picker.open').forEach(p => p.classList.remove('open'));
  if (!isOpen) picker.classList.add('open');
}

function selectReaction(postId, reactionType) {
  document.getElementById(`reaction-picker-${postId}`)?.classList.remove('open');
  reactToPost(postId, reactionType);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.reaction-picker-wrap')) {
    document.querySelectorAll('.reaction-picker.open').forEach(p => p.classList.remove('open'));
  }
  if (!e.target.closest('.post-menu-btn') && !e.target.closest('.post-dropdown')) {
    document.querySelectorAll('.post-dropdown').forEach(m => m.classList.add('hidden'));
  }
});

async function reactToPost(postId, reactionType) {
  try {
    const data = await PostsAPI.react(postId, reactionType);
    const btn = document.getElementById(`like-btn-${postId}`);
    if (btn) {
      const ur = data.userReaction;
      btn.className = ur ? `action-btn ${ur === 'love' ? 'loved' : 'liked'}` : 'action-btn';
      btn.innerHTML = ur ? `${REACTION_EMOJIS[ur]} ${capitalize(ur)}` : '👍 Like';
      btn.onclick = (e) => toggleReactionPicker(postId, e);
    }
    // Update reaction pills
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (postEl) {
      const pillsEl = postEl.querySelector('.reaction-pills');
      if (pillsEl && data.reactions) {
        const total = data.reactions.reduce((s, r) => s + r.count, 0);
        const top = data.reactions.sort((a, b) => b.count - a.count).slice(0, 3);
        if (total === 0) {
          pillsEl.parentElement.style.display = 'none';
        } else {
          pillsEl.innerHTML = top.map(r => `<span class="reaction-pill">${REACTION_EMOJIS[r.reaction_type]||'👍'}</span>`).join('') + `<span class="reaction-count">${total}</span>`;
        }
      }
    }
  } catch (e) { showToast('Failed to react', 'error'); }
}

async function savePost(postId) {
  try {
    const data = await PostsAPI.save(postId);
    const btn = document.getElementById(`save-btn-${postId}`);
    if (btn) btn.innerHTML = `🔖 ${data.saved ? 'Saved' : 'Save'}`;
    showToast(data.saved ? 'Post saved!' : 'Post unsaved', 'info');
  } catch (e) { showToast('Failed', 'error'); }
}

async function toggleComments(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  if (!section) return;
  if (section.style.display === 'none') {
    section.style.display = 'block';
    await loadComments(postId);
  } else {
    section.style.display = 'none';
  }
}

async function loadComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (!list) return;
  list.innerHTML = '<div style="padding:8px;text-align:center"><div class="spinner" style="margin:auto"></div></div>';
  try {
    const comments = await PostsAPI.comments(postId);
    list.innerHTML = comments.map(c => renderComment(c, postId)).join('');
  } catch (e) { list.innerHTML = ''; }
}

function renderComment(c, postId) {
  const user = window.currentUser;
  const isOwn = c.user_id === user?.id;
  const init = (c.name || '?')[0].toUpperCase();
  const av = c.avatar ? `<img src="${escapeHtml(c.avatar)}" class="avatar sm" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div class="avatar sm"><div class="avatar-inner sm">${init}</div></div>`;
  const reactionCount = c.reaction_count || 0;

  return `
    <div class="comment-item" id="comment-${c.id}">
      ${av}
      <div class="comment-body">
        <div class="comment-bubble">
          <div class="author"><a onclick="navigate('profile',{id:${c.user_id}})">${escapeHtml(c.name)}</a></div>
          <div class="text">${parseContent(c.content)}</div>
        </div>
        <div class="comment-meta">
          <span>${timeAgo(c.created_at)}</span>
          <button onclick="likeComment(${c.id})" class="${c.user_reaction ? 'liked' : ''}">${c.user_reaction ? REACTION_EMOJIS[c.user_reaction] : '👍'} ${reactionCount || ''}</button>
          <button onclick="openReplyInput(${c.id},${postId},'${escapeHtml(c.name)}')">Reply</button>
          ${isOwn ? `<button onclick="deleteComment(${c.id},${postId})">Delete</button>` : ''}
          ${c.reply_count > 0 ? `<button onclick="loadReplies(${c.id},${postId})">View ${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}</button>` : ''}
        </div>
        <div id="replies-${c.id}" class="replies-wrap"></div>
      </div>
    </div>
  `;
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    const comment = await PostsAPI.addComment(postId, content);
    const list = document.getElementById(`comments-list-${postId}`);
    if (list) list.insertAdjacentHTML('beforeend', renderComment(comment, postId));
    // Update comment count display
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (postEl) {
      const statsEl = postEl.querySelector('.post-stats');
      if (statsEl) {
        const countEl = statsEl.querySelector('[onclick*="toggleComments"]');
        if (countEl) {
          const cur = parseInt(countEl.textContent) || 0;
          countEl.textContent = `${cur + 1} comment${(cur + 1) !== 1 ? 's' : ''}`;
        }
      }
    }
  } catch (e) { showToast('Failed to post comment', 'error'); }
}

async function likeComment(commentId) {
  try {
    const data = await PostsAPI.commentReact(commentId, 'like');
    const commentEl = document.getElementById(`comment-${commentId}`);
    if (commentEl) {
      const likeBtn = commentEl.querySelector('.comment-meta button');
      if (likeBtn) {
        likeBtn.className = data.userReaction ? 'liked' : '';
        likeBtn.innerHTML = `${data.userReaction ? REACTION_EMOJIS[data.userReaction] : '👍'} ${data.count || ''}`;
      }
    }
  } catch (e) {}
}

function openReplyInput(commentId, postId, name) {
  const existingInput = document.getElementById(`reply-input-wrap-${commentId}`);
  if (existingInput) { existingInput.remove(); return; }
  const repliesEl = document.getElementById(`replies-${commentId}`);
  if (!repliesEl) return;
  const user = window.currentUser;
  const init = (user?.name || '?')[0].toUpperCase();
  const av = user?.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px">${init}</div>`;
  const wrap = document.createElement('div');
  wrap.id = `reply-input-wrap-${commentId}`;
  wrap.className = 'comment-input-row';
  wrap.style.marginTop = '6px';
  wrap.innerHTML = `${av}<div class="comment-input-box" style="flex:1"><textarea id="reply-input-${commentId}" placeholder="Reply to ${escapeHtml(name)}..." rows="1"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitReply(${commentId},${postId})}"></textarea>
    <button onclick="submitReply(${commentId},${postId})" style="color:var(--primary);font-weight:700;font-size:13px">Reply</button></div>`;
  repliesEl.appendChild(wrap);
  document.getElementById(`reply-input-${commentId}`)?.focus();
}

async function submitReply(commentId, postId) {
  const input = document.getElementById(`reply-input-${commentId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  try {
    const reply = await PostsAPI.addComment(postId, content, commentId);
    const repliesEl = document.getElementById(`replies-${commentId}`);
    const wrap = document.getElementById(`reply-input-wrap-${commentId}`);
    if (repliesEl) {
      const replyHtml = renderComment(reply, postId);
      if (wrap) wrap.insertAdjacentHTML('beforebegin', replyHtml);
      else repliesEl.insertAdjacentHTML('beforeend', replyHtml);
    }
    input.value = '';
  } catch (e) { showToast('Failed to reply', 'error'); }
}

async function loadReplies(commentId, postId) {
  const repliesEl = document.getElementById(`replies-${commentId}`);
  if (!repliesEl) return;
  try {
    const replies = await PostsAPI.replies(commentId);
    repliesEl.innerHTML = replies.map(r => renderComment(r, postId)).join('');
  } catch (e) {}
}

async function deleteComment(commentId, postId) {
  showConfirm('Delete Comment', 'Delete this comment?', async () => {
    try {
      await PostsAPI.deleteComment(commentId);
      document.getElementById(`comment-${commentId}`)?.remove();
    } catch (e) { showToast('Failed', 'error'); }
  });
}

function confirmDeletePost(postId) {
  showConfirm('Delete Post', 'Are you sure you want to delete this post?', async () => {
    try {
      await PostsAPI.delete(postId);
      document.querySelector(`[data-post-id="${postId}"]`)?.remove();
      showToast('Post deleted', 'info');
    } catch (e) { showToast('Failed to delete', 'error'); }
  });
}

function copyPostLink(postId) {
  navigator.clipboard?.writeText(window.location.origin + '/post/' + postId)
    .then(() => showToast('Link copied!', 'success'))
    .catch(() => showToast('Could not copy link', 'error'));
}

// ---- Create Post Modal ----
let composeFiles = [];
let composeBgColor = null;
let composeFeeling = null;
let composeFeelingEmoji = null;
let composeLocation = null;

function openCreatePostModal(focus) {
  const user = window.currentUser;
  const init = (user?.name || '?')[0].toUpperCase();
  const av = user?.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">` : `<div class="avatar md"><div class="avatar-inner md">${init}</div></div>`;
  composeFiles = []; composeBgColor = null; composeFeeling = null; composeFeelingEmoji = null; composeLocation = null;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'create-post-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>Create Post</h3>
        <button class="modal-close" onclick="document.getElementById('create-post-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="post-compose-header">
          ${av}
          <div>
            <div style="font-weight:700">${escapeHtml(user?.name)}</div>
            <div class="compose-privacy">
              <select id="compose-privacy" style="background:var(--input-bg);border:none;border-radius:6px;padding:4px 8px;font-size:13px;font-weight:600;color:var(--text)">
                <option value="public">🌐 Public</option>
                <option value="friends" selected>👥 Friends</option>
                <option value="only_me">🔒 Only Me</option>
              </select>
            </div>
          </div>
        </div>

        <div id="compose-bg-wrap" style="position:relative;padding:4px;border-radius:8px;margin-bottom:8px">
          <textarea id="compose-text" class="compose-textarea" placeholder="What's on your mind, ${escapeHtml(user?.name?.split(' ')[0] || '')}?" autofocus></textarea>
        </div>

        <div id="compose-feeling-display" style="display:none;font-size:14px;color:var(--text2);margin-bottom:6px"></div>
        <div id="compose-location-display" style="display:none;font-size:14px;color:var(--text2);margin-bottom:6px"></div>

        <div id="compose-media-preview" class="compose-media-preview"></div>

        <div id="compose-bg-picker" style="display:none;margin:8px 0">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text2)">Background Color</div>
          <div class="bg-color-picker">
            <div class="bg-swatch" style="background:none;border:2px solid var(--border)" onclick="setBgColor(null)" title="None">✕</div>
            ${BG_COLORS.map(c => `<div class="bg-swatch" style="background:${c}" onclick="setBgColor('${c}')"></div>`).join('')}
          </div>
        </div>

        <div id="compose-feeling-picker" style="display:none;margin:8px 0">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text2)">How are you feeling?</div>
          <div class="feeling-grid">
            ${[['😊','happy'],['😢','sad'],['😡','angry'],['🤩','excited'],['😌','peaceful'],['🥰','loved'],['🤔','thoughtful'],['🏆','accomplished'],['🙏','grateful'],['💡','inspired'],['🎨','creative'],['🎉','celebrating']].map(([e,f]) => `
              <div class="feeling-item" onclick="setFeeling('${f}','${e}')"><span class="emoji">${e}</span><span>${f}</span></div>
            `).join('')}
          </div>
        </div>

        <div class="compose-options">
          <button class="compose-opt-btn" onclick="document.getElementById('compose-file').click()">
            📷 Photo/Video
            <input type="file" id="compose-file" multiple accept="image/*,video/*" style="display:none" onchange="handleComposeFiles(this.files)">
          </button>
          <button class="compose-opt-btn" onclick="toggleSection('compose-bg-picker')">🎨 Background</button>
          <button class="compose-opt-btn" onclick="toggleSection('compose-feeling-picker')">😊 Feeling</button>
          <button class="compose-opt-btn" onclick="setLocation()">📍 Location</button>
        </div>

        <button class="btn-primary" onclick="submitPost()">Post</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  if (focus === 'photo') document.getElementById('compose-file')?.click();
  else if (focus === 'feeling') toggleSection('compose-feeling-picker');
  else if (focus === 'location') setLocation();
}

function toggleSection(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function setBgColor(color) {
  composeBgColor = color;
  const wrap = document.getElementById('compose-bg-wrap');
  const textarea = document.getElementById('compose-text');
  if (wrap && color) {
    wrap.style.background = color;
    wrap.style.padding = '24px';
    if (textarea) { textarea.style.textAlign = 'center'; textarea.style.fontSize = '20px'; textarea.style.fontWeight = '600'; textarea.style.color = 'white'; }
  } else if (wrap) {
    wrap.style.background = '';
    wrap.style.padding = '4px';
    if (textarea) { textarea.style.textAlign = ''; textarea.style.fontSize = ''; textarea.style.fontWeight = ''; textarea.style.color = ''; }
  }
  document.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('selected'));
  if (color) document.querySelector(`.bg-swatch[style="background:${color}"]`)?.classList.add('selected');
}

function setFeeling(feeling, emoji) {
  composeFeeling = feeling;
  composeFeelingEmoji = emoji;
  const display = document.getElementById('compose-feeling-display');
  if (display) { display.style.display = 'block'; display.textContent = `${emoji} feeling ${feeling}`; }
  document.getElementById('compose-feeling-picker').style.display = 'none';
}

async function setLocation() {
  const loc = prompt('Enter your location:');
  if (loc) {
    composeLocation = loc;
    const display = document.getElementById('compose-location-display');
    if (display) { display.style.display = 'block'; display.textContent = `📍 ${loc}`; }
  }
}

function handleComposeFiles(files) {
  const preview = document.getElementById('compose-media-preview');
  if (!preview) return;
  const newFiles = Array.from(files);
  composeFiles = [...composeFiles, ...newFiles].slice(0, 10);
  preview.innerHTML = '';
  composeFiles.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'compose-media-item';
    const isVideo = file.type.startsWith('video');
    const el = document.createElement(isVideo ? 'video' : 'img');
    el.src = URL.createObjectURL(file);
    if (isVideo) { el.controls = true; el.muted = true; }
    el.style.cssText = 'max-height:200px;width:100%;object-fit:cover;border-radius:8px;';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-media';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => { composeFiles.splice(i, 1); handleComposeFiles([]); };
    item.appendChild(el);
    item.appendChild(removeBtn);
    preview.appendChild(item);
  });
}

async function submitPost() {
  const content = document.getElementById('compose-text')?.value.trim();
  const privacy = document.getElementById('compose-privacy')?.value || 'friends';
  if (!content && !composeFiles.length) { showToast('Add some content', 'error'); return; }

  const formData = new FormData();
  formData.append('content', content || '');
  formData.append('privacy', privacy);
  if (composeBgColor) formData.append('bg_color', composeBgColor);
  if (composeFeeling) formData.append('feeling', composeFeeling);
  if (composeFeelingEmoji) formData.append('feeling_emoji', composeFeelingEmoji);
  if (composeLocation) formData.append('location', composeLocation);
  composeFiles.forEach(f => formData.append('media', f));

  const btn = document.querySelector('#create-post-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }

  try {
    const post = await PostsAPI.create(formData);
    document.getElementById('create-post-modal')?.remove();
    const container = document.getElementById('posts-container');
    if (container) container.insertAdjacentHTML('afterbegin', renderPostCard(post));
    showToast('Post shared!', 'success');
  } catch (e) {
    showToast(e.message || 'Failed to post', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
  }
}

// Edit post modal
async function openEditPostModal(postId) {
  try {
    const post = await PostsAPI.get(postId);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'edit-post-modal';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Post</h3>
          <button class="modal-close" onclick="document.getElementById('edit-post-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <textarea id="edit-post-content" class="compose-textarea form-input" style="min-height:120px">${escapeHtml(post.content)}</textarea>
          <div class="compose-privacy" style="margin:10px 0">
            <select id="edit-post-privacy" class="form-input" style="width:auto">
              <option value="public" ${post.privacy==='public'?'selected':''}>🌐 Public</option>
              <option value="friends" ${post.privacy==='friends'?'selected':''}>👥 Friends</option>
              <option value="only_me" ${post.privacy==='only_me'?'selected':''}>🔒 Only Me</option>
            </select>
          </div>
          <button class="btn-primary" onclick="submitEditPost(${postId})">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  } catch (e) {}
}

async function submitEditPost(postId) {
  const content = document.getElementById('edit-post-content')?.value.trim();
  const privacy = document.getElementById('edit-post-privacy')?.value;
  try {
    const updated = await PostsAPI.update(postId, { content, privacy });
    document.getElementById('edit-post-modal')?.remove();
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (postEl) {
      const textEl = postEl.querySelector('.post-text');
      if (textEl) textEl.innerHTML = parseContent(updated.content);
    }
    showToast('Post updated!', 'success');
  } catch (e) { showToast('Failed to update', 'error'); }
}

// Share modal
function openShareModal(postId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Share Post</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <textarea class="compose-textarea form-input" id="share-content" placeholder="Say something about this..." style="min-height:80px;margin-bottom:10px"></textarea>
        <select id="share-privacy" class="form-input" style="width:auto;margin-bottom:12px">
          <option value="public">🌐 Public</option>
          <option value="friends" selected>👥 Friends</option>
        </select>
        <button class="btn-primary" onclick="submitShare(${postId},this)">Share Now</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function submitShare(postId, btn) {
  const content = document.getElementById('share-content')?.value.trim();
  const privacy = document.getElementById('share-privacy')?.value;
  btn.disabled = true; btn.textContent = 'Sharing...';
  try {
    const post = await PostsAPI.share(postId, content, privacy);
    btn.closest('.modal-overlay').remove();
    const container = document.getElementById('posts-container');
    if (container) container.insertAdjacentHTML('afterbegin', renderPostCard(post));
    showToast('Shared!', 'success');
  } catch (e) { showToast('Failed to share', 'error'); btn.disabled = false; btn.textContent = 'Share Now'; }
}

function capitalize(str) { return str ? str[0].toUpperCase() + str.slice(1) : ''; }
