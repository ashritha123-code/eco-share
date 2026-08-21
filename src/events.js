/**
 * Community Events & Swap Meets Module for EcoCircle
 * Manages local eco-events, clothes swaps, repair cafes, and attendee RSVPs.
 */

import { getLoggedInUser } from './auth.js';
import { dbService } from './firebase-config.js';

let eventsState = [];
let currentEventTypeFilter = 'All';

export function initEvents(showToast) {
  // Subscribe to real-time events from active provider (Supabase/Firebase/DB)
  dbService.onEventsChanged((events) => {
    eventsState = (events || []).filter(evt => evt && evt.eventId && !evt.eventId.startsWith('evt_00'));
    renderEvents(showToast);
  });

  const hostEventBtn = document.getElementById('hostEventBtn');
  const addEventModal = document.getElementById('addEventModal');
  const cancelAddEventBtn = document.getElementById('cancelAddEventBtn');
  const addEventForm = document.getElementById('addEventForm');

  const filterScroll = document.getElementById('eventsFilterScroll');

  // Filter Chips Listener
  if (filterScroll) {
    filterScroll.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      document.querySelectorAll('#eventsFilterScroll .category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentEventTypeFilter = chip.dataset.eventType || 'All';
      renderEvents(showToast);
    });
  }

  // Modal Triggers
  if (hostEventBtn && addEventModal) {
    hostEventBtn.addEventListener('click', () => {
      const user = getLoggedInUser();
      if (!user) {
        showToast('Please log in to host a community event.', 'warning');
        return;
      }
      addEventForm.reset();
      addEventModal.classList.add('active');
    });
  }

  if (cancelAddEventBtn && addEventModal) {
    cancelAddEventBtn.addEventListener('click', () => {
      addEventModal.classList.remove('active');
    });
  }

  if (addEventModal) {
    window.addEventListener('click', (e) => {
      if (e.target === addEventModal) {
        addEventModal.classList.remove('active');
      }
    });
  }

  // Event Creation Form Handler
  if (addEventForm) {
    addEventForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = getLoggedInUser();
      if (!user) {
        showToast('Please log in to publish an event.', 'warning');
        return;
      }

      const title = document.getElementById('eventTitle').value.trim();
      const type = document.getElementById('eventType').value;
      const date = document.getElementById('eventDate').value;
      const location = document.getElementById('eventLocation').value.trim();
      const description = document.getElementById('eventDescription').value.trim();

      if (!title || !type || !date || !location || !description) {
        showToast('Please complete all required event fields.', 'warning');
        return;
      }

      const newEvent = {
        eventId: 'evt_' + Date.now(),
        title,
        type,
        date,
        location,
        organizerName: user.displayName || user.email || 'Community Member',
        organizerId: user.uid,
        description,
        attendees: [user.uid],
        createdAt: new Date().toISOString()
      };

      // 1. Immediately push to local state & re-render for 0ms lag
      eventsState = [newEvent, ...eventsState.filter(e => e.eventId !== newEvent.eventId)];
      renderEvents(showToast);
      showToast('Community Event published successfully! 🎉', 'success');
      addEventModal.classList.remove('active');
      addEventForm.reset();

      // 2. Persist to active database provider (Supabase / Local DB)
      dbService.addEvent(newEvent).catch(err => {
        console.warn('Background event sync notice:', err);
      });
    });
  }

  renderEvents(showToast);
}

export function renderEvents(showToast) {
  const eventsGrid = document.getElementById('eventsGrid');
  if (!eventsGrid) return;

  const user = getLoggedInUser();
  let filtered = [...eventsState];

  if (currentEventTypeFilter !== 'All') {
    filtered = filtered.filter(evt => evt.type === currentEventTypeFilter);
  }

  if (filtered.length === 0) {
    eventsGrid.innerHTML = `
      <div class="no-results" style="grid-column: 1 / -1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <h3>No upcoming events in this category</h3>
        <p>Click "Host an Event" above to organize a swap meet or workshop!</p>
      </div>
    `;
    return;
  }

  eventsGrid.innerHTML = '';

  filtered.forEach(evt => {
    const card = document.createElement('div');
    card.className = 'event-card';

    const isAttending = user && evt.attendees && evt.attendees.includes(user.uid);
    const attendeeCount = evt.attendees ? evt.attendees.length : 0;

    let formattedDate = 'Upcoming Date';
    try {
      const d = new Date(evt.date);
      formattedDate = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {}

    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-card-type">${evt.type}</span>
        <div class="event-card-date">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>${formattedDate}</span>
        </div>
      </div>
      <div class="event-card-body">
        <h3 class="event-card-title">${evt.title}</h3>
        <div class="event-card-location">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>${evt.location}</span>
        </div>
        <p class="event-card-desc">${evt.description}</p>
        <div style="font-size: 0.75rem; color: var(--primary); font-weight: 600;">Host: ${evt.organizerName}</div>
      </div>
      <div class="event-card-footer">
        <div class="event-attendees">
          <span>👥 ${attendeeCount} Neighbor${attendeeCount === 1 ? '' : 's'} Going</span>
        </div>
        <button class="btn btn-rsvp ${isAttending ? 'attending' : 'btn-primary'} rsvp-btn" data-event-id="${evt.eventId}">
          ${isAttending ? '✓ Attending' : 'RSVP / Join'}
        </button>
      </div>
    `;

    const rsvpBtn = card.querySelector('.rsvp-btn');
    if (rsvpBtn) {
      rsvpBtn.addEventListener('click', async () => {
        const currentUser = getLoggedInUser();
        if (!currentUser) {
          if (showToast) showToast('Please log in to RSVP for events.', 'warning');
          return;
        }

        const wasAttending = evt.attendees && evt.attendees.includes(currentUser.uid);
        if (wasAttending) {
          if (showToast) showToast('Cancelled RSVP for event.', 'info');
        } else {
          if (showToast) showToast('RSVP Confirmed! See you there! 🎉', 'success');
        }
        await dbService.toggleEventRsvp(evt.eventId, currentUser.uid);
      });
    }

    eventsGrid.appendChild(card);
  });
}
