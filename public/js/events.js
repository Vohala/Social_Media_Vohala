// ============================================================
// EVENTS.JS — Events page
// ============================================================

async function renderEventsPage(container, params) {
  if (params.id) { renderEventDetail(container, params.id); return; }

  container.innerHTML = `
    <div class="two-col-layout">
      <main>
        <div class="section-header">
          <h2>Events</h2>
          <button class="btn-primary btn-sm" onclick="openCreateEventModal()">+ Create Event</button>
        </div>
        <div class="section-tabs">
          <div class="section-tab active" onclick="switchEventsTab('upcoming',this)">Upcoming</div>
          <div class="section-tab" onclick="switchEventsTab('my',this)">My Events</div>
        </div>
        <div id="events-content">
          <div class="loading-center"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
  loadEventsTab('upcoming');
}

async function loadEventsTab(tab) {
  const content = document.getElementById('events-content');
  content.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  const events = await EventsAPI.list().catch(() => []);
  const uid = window.currentUser?.id;

  let filtered = events;
  if (tab === 'my') filtered = events.filter(e => e.creator_id === uid || e.my_response);

  if (!filtered.length) {
    content.innerHTML = '<div class="empty-state"><h3>No events</h3><p>Create an event to get started!</p></div>';
    return;
  }

  content.innerHTML = `<div class="events-list">
    ${filtered.map(e => {
      const d = new Date(e.start_date);
      const month = d.toLocaleDateString('en-IN', { month: 'short' });
      const day = d.getDate();
      return `<div class="event-card" onclick="navigate('events',{id:${e.id}})">
        <div class="event-date-block">
          <div class="month">${month}</div>
          <div class="day">${day}</div>
        </div>
        <div class="event-info">
          <h4>${escapeHtml(e.title)}</h4>
          <div class="event-meta">
            📅 ${formatDate(e.start_date)}<br>
            ${e.location ? `📍 ${escapeHtml(e.location)}` : ''}
          </div>
          <div style="font-size:13px;color:var(--text3)">${e.going_count} going · ${e.interested_count} interested</div>
          <div class="event-actions" onclick="event.stopPropagation()">
            <button class="rsvp-btn ${e.my_response === 'going' ? 'going' : 'interested'}" onclick="rsvpEvent(${e.id},'going',this)">
              ${e.my_response === 'going' ? '✓ Going' : 'Going'}
            </button>
            <button class="rsvp-btn ${e.my_response === 'interested' ? 'going' : 'interested'}" onclick="rsvpEvent(${e.id},'interested',this)">
              ${e.my_response === 'interested' ? '★ Interested' : 'Interested'}
            </button>
          </div>
        </div>
        ${e.cover_photo ? `<img src="${escapeHtml(e.cover_photo)}" style="width:100px;height:100%;object-fit:cover;flex-shrink:0">` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function switchEventsTab(tab, el) {
  document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadEventsTab(tab);
}

async function rsvpEvent(eventId, response, btn) {
  try {
    const data = await EventsAPI.rsvp(eventId, response);
    btn.className = `rsvp-btn going`;
    btn.textContent = response === 'going' ? '✓ Going' : '★ Interested';
    showToast(`RSVP updated!`, 'success');
  } catch (e) { showToast('Failed', 'error'); }
}

async function renderEventDetail(container, eventId) {
  container.innerHTML = '<div class="loading-center" style="padding:60px"><div class="spinner"></div></div>';
  try {
    const event = await EventsAPI.get(eventId);
    const d = new Date(event.start_date);
    container.innerHTML = `
      <div style="max-width:680px;margin:0 auto;padding:16px">
        <button class="btn-secondary btn-sm" onclick="navigate('events')" style="margin-bottom:12px">‹ Back to Events</button>
        <div class="card" style="overflow:hidden">
          <div style="height:240px;background:linear-gradient(135deg,var(--primary),var(--accent));overflow:hidden">
            ${event.cover_photo ? `<img src="${escapeHtml(event.cover_photo)}" style="width:100%;height:100%;object-fit:cover">` : ''}
          </div>
          <div style="padding:16px">
            <h2 style="font-size:22px;font-weight:800;margin-bottom:8px">${escapeHtml(event.title)}</h2>
            <div style="display:grid;gap:8px;margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:8px;color:var(--text2)">
                <span style="font-size:18px">📅</span>
                <span>${formatDate(event.start_date)}${event.end_date ? ' — ' + formatDate(event.end_date) : ''}</span>
              </div>
              ${event.location ? `<div style="display:flex;align-items:center;gap:8px;color:var(--text2)"><span style="font-size:18px">📍</span><span>${escapeHtml(event.location)}</span></div>` : ''}
              <div style="display:flex;align-items:center;gap:8px;color:var(--text2)">
                <span style="font-size:18px">👤</span>
                <span>By <a onclick="navigate('profile',{id:${event.creator_id}})" style="color:var(--primary);font-weight:600;cursor:pointer">${escapeHtml(event.creator_name)}</a></span>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:14px">
              <span style="font-size:14px;color:var(--text2)">✅ ${event.going_count} going · ⭐ ${event.interested_count} interested</span>
            </div>
            <div class="event-actions">
              <button class="rsvp-btn ${event.my_response === 'going' ? 'going' : 'interested'}" onclick="rsvpEventDetail(${event.id},'going',this)">${event.my_response === 'going' ? '✓ Going' : 'Going'}</button>
              <button class="rsvp-btn ${event.my_response === 'interested' ? 'going' : 'interested'}" onclick="rsvpEventDetail(${event.id},'interested',this)">${event.my_response === 'interested' ? '★ Interested' : 'Interested'}</button>
              <button class="rsvp-btn interested" onclick="rsvpEventDetail(${event.id},'not_going',this)">Not Going</button>
            </div>
            ${event.description ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border2);color:var(--text2)">${escapeHtml(event.description)}</div>` : ''}
          </div>
        </div>
        ${event.attendees?.length ? `
          <div class="card" style="margin-top:12px;padding:14px">
            <h4 style="margin-bottom:10px">Attendees</h4>
            ${event.attendees.slice(0, 12).map(a => `
              <div class="contact-item" onclick="navigate('profile',{id:${a.id}})">
                ${a.avatar ? `<img src="${escapeHtml(a.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : `<div class="avatar sm"><div class="avatar-inner sm">${a.name[0]}</div></div>`}
                <div>
                  <div style="font-size:14px;font-weight:600">${escapeHtml(a.name)}</div>
                  <div style="font-size:12px;color:var(--text3)">${a.response === 'going' ? '✅ Going' : '⭐ Interested'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } catch (e) { container.innerHTML = '<div class="empty-state"><h3>Event not found</h3></div>'; }
}

async function rsvpEventDetail(eventId, response, btn) {
  try {
    await EventsAPI.rsvp(eventId, response);
    showToast('RSVP updated!', 'success');
  } catch (e) { showToast('Failed', 'error'); }
}

function openCreateEventModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Create Event</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      <div class="modal-body">
        <form id="create-event-form">
          <div class="form-group"><label>Event Name *</label><input class="form-input" id="ev-title" placeholder="Event name" required></div>
          <div class="form-group"><label>Description</label><textarea class="form-input" id="ev-desc" rows="3" placeholder="Tell people about your event..."></textarea></div>
          <div class="form-group"><label>Start Date & Time *</label><input type="datetime-local" class="form-input" id="ev-start" required></div>
          <div class="form-group"><label>End Date & Time</label><input type="datetime-local" class="form-input" id="ev-end"></div>
          <div class="form-group"><label>Location</label><input class="form-input" id="ev-loc" placeholder="Where is it?"></div>
          <div class="form-group"><label>Cover Photo</label><input type="file" class="form-input" id="ev-cover" accept="image/*"></div>
          <div class="form-group"><label>Privacy</label>
            <select class="form-input" id="ev-privacy">
              <option value="public">🌐 Public</option>
              <option value="friends">👥 Friends</option>
            </select>
          </div>
          <button type="submit" class="btn-primary">Create Event</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('ev-title').value);
    formData.append('description', document.getElementById('ev-desc').value);
    formData.append('start_date', document.getElementById('ev-start').value);
    formData.append('end_date', document.getElementById('ev-end').value || '');
    formData.append('location', document.getElementById('ev-loc').value);
    formData.append('privacy', document.getElementById('ev-privacy').value);
    const cover = document.getElementById('ev-cover').files[0];
    if (cover) formData.append('cover', cover);
    try {
      const event = await EventsAPI.create(formData);
      modal.remove();
      navigate('events', { id: event.id });
      showToast('Event created!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });
}
