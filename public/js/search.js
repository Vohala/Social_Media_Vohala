// ============================================================
// SEARCH.JS — Search results page
// ============================================================

async function renderSearchPage(container, params) {
  const q = params.q || '';
  let currentType = 'all';

  container.innerHTML = `
    <div class="two-col-layout">
      <main>
        <div class="section-header">
          <h2>Search Results${q ? ` for "${escapeHtml(q)}"` : ''}</h2>
        </div>
        <div class="search-filters">
          ${['all','people','posts','groups','events'].map(t => `
            <button class="filter-btn ${t === 'all' ? 'active' : ''}" onclick="setSearchType('${t}',this,'${escapeHtml(q)}')">${capitalize(t)}</button>
          `).join('')}
        </div>
        <div id="search-results">
          <div class="loading-center"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;

  if (q) performSearch(q, 'all');
}

function setSearchType(type, btn, q) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  performSearch(q, type);
}

async function performSearch(q, type) {
  const results = document.getElementById('search-results');
  results.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  try {
    const data = await SearchAPI.search(q, type);
    renderSearchResults(data, type, q);
  } catch (e) {
    results.innerHTML = '<div class="empty-state"><h3>Search failed</h3></div>';
  }
}

function renderSearchResults(data, type, q) {
  const results = document.getElementById('search-results');
  let html = '';

  const people = data.people || [];
  const posts = data.posts || [];
  const groups = data.groups || [];
  const events = data.events || [];

  if (!people.length && !posts.length && !groups.length && !events.length) {
    results.innerHTML = `<div class="empty-state"><h3>No results for "${escapeHtml(q)}"</h3><p>Try searching for something else</p></div>`;
    return;
  }

  if ((type === 'all' || type === 'people') && people.length) {
    html += `<div style="margin-bottom:20px"><h3 style="font-size:18px;font-weight:700;margin-bottom:10px">People</h3>
      <div class="friends-grid">
        ${people.map(p => `
          <div class="friend-card">
            <div class="friend-card-cover">
              <div class="friend-card-avatar">${p.avatar ? `<img src="${escapeHtml(p.avatar)}">` : p.name[0].toUpperCase()}</div>
            </div>
            <div class="friend-card-info">
              <h4>${escapeHtml(p.name)}</h4>
              <p>${p.mutual_friends > 0 ? `${p.mutual_friends} mutual friends` : `@${escapeHtml(p.username)}`}</p>
              <div class="friend-card-actions">
                ${p.is_friend ? `<button class="btn-secondary" style="flex:1;padding:7px;font-size:13px" onclick="navigate('profile',{id:${p.id}})">Friends</button>` : `<button class="btn-primary" style="flex:1;padding:7px;font-size:13px" onclick="sendFriendRequestFromPage(${p.id},this)">Add Friend</button>`}
                <button class="btn-secondary" style="flex:1;padding:7px;font-size:13px" onclick="navigate('profile',{id:${p.id}})">Profile</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  if ((type === 'all' || type === 'posts') && posts.length) {
    html += `<div style="margin-bottom:20px"><h3 style="font-size:18px;font-weight:700;margin-bottom:10px">Posts</h3>
      ${posts.map(p => `
        <div class="card" style="padding:12px;margin-bottom:8px;cursor:pointer" onclick="navigate('feed')">
          <div class="d-flex align-center gap-8" style="margin-bottom:6px">
            ${p.avatar ? `<img src="${escapeHtml(p.avatar)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div class="avatar sm"><div class="avatar-inner sm">${(p.name||'?')[0]}</div></div>`}
            <div>
              <div style="font-weight:700;font-size:14px">${escapeHtml(p.name)}</div>
              <div style="font-size:12px;color:var(--text3)">${timeAgo(p.created_at)}</div>
            </div>
          </div>
          <p style="font-size:14px;color:var(--text2)">${escapeHtml(p.content?.substring(0, 200))}${p.content?.length > 200 ? '...' : ''}</p>
        </div>
      `).join('')}
    </div>`;
  }

  if ((type === 'all' || type === 'groups') && groups.length) {
    html += `<div style="margin-bottom:20px"><h3 style="font-size:18px;font-weight:700;margin-bottom:10px">Groups</h3>
      <div class="group-grid">
        ${groups.map(g => `
          <div class="group-card" onclick="navigate('groups',{id:${g.id}})">
            <div class="group-card-cover"></div>
            <div class="group-card-info">
              <h4>${escapeHtml(g.name)}</h4>
              <p>${g.privacy} group · By ${escapeHtml(g.creator_name)}</p>
            </div>
            <div class="group-card-footer">
              <button class="btn-primary" style="flex:1;padding:7px;font-size:13px" onclick="event.stopPropagation();joinGroupFromCard(${g.id},this)">Join</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  if ((type === 'all' || type === 'events') && events.length) {
    html += `<div style="margin-bottom:20px"><h3 style="font-size:18px;font-weight:700;margin-bottom:10px">Events</h3>
      <div class="events-list">
        ${events.map(e => {
          const d = new Date(e.start_date);
          return `<div class="event-card" onclick="navigate('events',{id:${e.id}})">
            <div class="event-date-block">
              <div class="month">${d.toLocaleDateString('en-IN',{month:'short'})}</div>
              <div class="day">${d.getDate()}</div>
            </div>
            <div class="event-info">
              <h4>${escapeHtml(e.title)}</h4>
              <div class="event-meta">${e.location ? `📍 ${escapeHtml(e.location)}` : ''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  results.innerHTML = html || '<div class="empty-state"><h3>No results found</h3></div>';
}
