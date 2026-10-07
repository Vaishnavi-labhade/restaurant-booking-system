// ============================================================
// RESTAURANT TABLE BOOKING SYSTEM - CLIENT SCRIPT (script.js)
// Technologies: Vanilla JavaScript (ES6+), Fetch API
// Features: Form Validation, Real-Time Availability, Confirmation Modal,
//           Cancellation, and Feedback/Rating System
// ============================================================

// ============================================================
// API HELPER: finds the backend no matter how the page was opened
// (Express at :5000, VS Code Live Server :5500, or a double-clicked file)
// ============================================================
const FALLBACK_API = 'http://localhost:5000';
let apiBase = location.protocol === 'file:' ? FALLBACK_API : '';

async function apiFetch(path, options) {
  const bases = apiBase === '' ? ['', FALLBACK_API] : [apiBase, ''];
  let lastError;
  for (const base of bases) {
    if (base === '' && location.protocol === 'file:') continue;
    try {
      const res = await fetch(base + path, options);
      const type = res.headers.get('content-type') || '';
      if (!type.includes('application/json')) throw new Error('Not the booking API');
      apiBase = base; // remember the working address
      return res;
    } catch (err) {
      lastError = err; // only reached when no booking was created, safe to retry
    }
  }
  throw lastError;
}

document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------
  // 1. DOM ELEMENTS: BOOKING FORM & INPUTS
  // ------------------------------------------------------------
  const bookingForm = document.getElementById('bookingForm');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const guestsInput = document.getElementById('guests');
  const dateInput = document.getElementById('date');
  const timeInput = document.getElementById('time');
  const specialRequestInput = document.getElementById('specialRequest');

  // Error spans
  const nameError = document.getElementById('nameError');
  const emailError = document.getElementById('emailError');
  const phoneError = document.getElementById('phoneError');
  const guestsError = document.getElementById('guestsError');
  const dateError = document.getElementById('dateError');
  const timeError = document.getElementById('timeError');

  // Submit button & status message
  const formMessage = document.getElementById('formMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  // Table availability elements
  const availTablesCount = document.getElementById('availTablesCount');
  const availDateLabel = document.getElementById('availDateLabel');
  const availBadge = document.getElementById('availBadge');

  // Bookings list table
  const bookingsTableBody = document.getElementById('bookingsTableBody');
  const refreshBookingsBtn = document.getElementById('refreshBookingsBtn');

  // Confirmation Modal elements
  const confirmationModal = document.getElementById('confirmationModal');
  const confirmId = document.getElementById('confirmId');
  const confirmName = document.getElementById('confirmName');
  const confirmTable = document.getElementById('confirmTable');
  const confirmDateTime = document.getElementById('confirmDateTime');
  const confirmGuests = document.getElementById('confirmGuests');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const printConfirmBtn = document.getElementById('printConfirmBtn');

  // Feedback & Reviews elements
  const reviewForm = document.getElementById('reviewForm');
  const reviewName = document.getElementById('reviewName');
  const reviewNameError = document.getElementById('reviewNameError');
  const reviewComment = document.getElementById('reviewComment');
  const reviewCommentError = document.getElementById('reviewCommentError');
  const starRating = document.getElementById('starRating');
  const ratingValueInput = document.getElementById('ratingValue');
  const ratingLabel = document.getElementById('ratingLabel');
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  const reviewBtnText = document.getElementById('reviewBtnText');
  const reviewSpinner = document.getElementById('reviewSpinner');
  const reviewMessage = document.getElementById('reviewMessage');
  const avgRatingScore = document.getElementById('avgRatingScore');
  const avgStarsDisplay = document.getElementById('avgStarsDisplay');
  const reviewsCount = document.getElementById('reviewsCount');
  const reviewsList = document.getElementById('reviewsList');

  // Mobile navigation
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  // ------------------------------------------------------------
  // 2. MOBILE NAVIGATION TOGGLE
  // ------------------------------------------------------------
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });

    const links = navLinks.querySelectorAll('.nav-item');
    links.forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }

  // ------------------------------------------------------------
  // 3. DATE SETUP & DEFAULT RESTRICTIONS
  // ------------------------------------------------------------
  const today = new Date().toISOString().split('T')[0];
  if (dateInput) {
    dateInput.setAttribute('min', today);
    dateInput.value = today;
  }

  // ------------------------------------------------------------
  // 4. VALIDATION HELPERS
  // ------------------------------------------------------------
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    return /^\d{10,15}$/.test(cleaned);
  }

  function clearError(inputElem, errorElem) {
    if (inputElem) inputElem.classList.remove('input-error');
    if (errorElem) errorElem.textContent = '';
  }

  function setError(inputElem, errorElem, message) {
    if (inputElem) inputElem.classList.add('input-error');
    if (errorElem) errorElem.textContent = message;
  }

  function clearAllBookingErrors() {
    clearError(nameInput, nameError);
    clearError(emailInput, emailError);
    clearError(phoneInput, phoneError);
    clearError(guestsInput, guestsError);
    clearError(dateInput, dateError);
    clearError(timeInput, timeError);
  }

  function showMessage(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = `form-message ${type}`;
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideMessage(element) {
    if (!element) return;
    element.className = 'form-message';
    element.textContent = '';
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Real-time input listeners to clear errors on typing
  nameInput.addEventListener('input', () => clearError(nameInput, nameError));
  emailInput.addEventListener('input', () => clearError(emailInput, emailError));
  phoneInput.addEventListener('input', () => clearError(phoneInput, phoneError));
  guestsInput.addEventListener('input', () => clearError(guestsInput, guestsError));
  dateInput.addEventListener('input', () => clearError(dateInput, dateError));
  timeInput.addEventListener('input', () => clearError(timeInput, timeError));

  // ------------------------------------------------------------
  // 5. LIVE TABLE AVAILABILITY
  // ------------------------------------------------------------
  async function fetchAvailability(targetDate) {
    const dateToCheck = targetDate || dateInput.value || today;

    try {
      const res = await apiFetch(`/api/availability?date=${dateToCheck}&t=${Date.now()}`);
      const data = await res.json();

      if (data.success) {
        if (availTablesCount) availTablesCount.textContent = data.availableTables;
        if (availDateLabel) availDateLabel.textContent = dateToCheck === today ? 'Today' : dateToCheck;

        if (availBadge) {
          if (data.isFullyBooked) {
            availBadge.textContent = 'Fully Booked';
            availBadge.className = 'badge-avail full';
          } else {
            availBadge.textContent = `${data.availableTables} Tables Available`;
            availBadge.className = 'badge-avail open';
          }
        }
      }
    } catch (err) {
      console.error('Availability fetch error:', err);
    }
  }

  // Update availability when user selects a different date
  dateInput.addEventListener('change', () => {
    fetchAvailability(dateInput.value);
  });

  // ------------------------------------------------------------
  // 6. BOOKING FORM SUBMISSION
  // ------------------------------------------------------------
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllBookingErrors();
    hideMessage(formMessage);

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const guests = guestsInput.value.trim();
    const date = dateInput.value.trim();
    const time = timeInput.value.trim();
    const specialRequest = specialRequestInput.value.trim();

    let hasError = false;

    if (!name || name.length < 2) {
      setError(nameInput, nameError, 'Please enter a valid customer name (at least 2 letters).');
      hasError = true;
    }

    if (!email || !isValidEmail(email)) {
      setError(emailInput, emailError, 'Please enter a valid email address.');
      hasError = true;
    }

    if (!phone || !isValidPhone(phone)) {
      setError(phoneInput, phoneError, 'Please enter a valid phone number (at least 10 digits).');
      hasError = true;
    }

    const guestNum = parseInt(guests, 10);
    if (!guests || isNaN(guestNum) || guestNum < 1 || guestNum > 20) {
      setError(guestsInput, guestsError, 'Please select between 1 and 20 guests.');
      hasError = true;
    }

    if (!date) {
      setError(dateInput, dateError, 'Please select a reservation date.');
      hasError = true;
    } else if (date < today) {
      setError(dateInput, dateError, 'Reservation date cannot be in the past.');
      hasError = true;
    }

    if (!time) {
      setError(timeInput, timeError, 'Please select a reservation time.');
      hasError = true;
    }

    if (hasError) return;

    // Submit booking to backend
    submitBtn.disabled = true;
    btnText.textContent = 'Reserving Table...';
    btnSpinner.classList.remove('hidden');

    try {
      const response = await apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          guests: guestNum,
          date,
          time,
          specialRequest
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Reset form
        bookingForm.reset();
        dateInput.value = today;

        // Show Booking Confirmation Modal
        showConfirmationModal(result.data);

        // Refresh bookings table & availability counter
        fetchAndDisplayBookings();
        fetchAvailability(date);
      } else {
        showMessage(formMessage, result.message || 'Unable to book table. Please try again.', 'error');
      }
    } catch (networkError) {
      console.error('Network booking error:', networkError);
      showMessage(
        formMessage,
        'Cannot reach the server. Please start it (run "npm start" in the project folder) and open http://localhost:5000',
        'error'
      );
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = 'Book Table';
      btnSpinner.classList.add('hidden');
    }
  });

  // ------------------------------------------------------------
  // 7. BOOKING CONFIRMATION POPUP MODAL
  // ------------------------------------------------------------
  function showConfirmationModal(booking) {
    if (!confirmationModal || !booking) return;

    // Fill in receipt details
    const shortId = booking._id ? `#FTB-${booking._id.slice(-6).toUpperCase()}` : '#FTB-0001';
    confirmId.textContent = shortId;
    confirmName.textContent = booking.name;
    confirmTable.textContent = `Table #${booking.tableNumber || 1}`;
    confirmDateTime.textContent = `${booking.date} at ${booking.time}`;
    confirmGuests.textContent = `${booking.guests} Guest${booking.guests > 1 ? 's' : ''}`;

    // Display modal
    confirmationModal.classList.remove('hidden');
  }

  function hideConfirmationModal() {
    if (confirmationModal) {
      confirmationModal.classList.add('hidden');
    }
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideConfirmationModal);
  }

  if (confirmationModal) {
    confirmationModal.addEventListener('click', (e) => {
      if (e.target === confirmationModal) hideConfirmationModal();
    });
  }

  if (printConfirmBtn) {
    printConfirmBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // ------------------------------------------------------------
  // 8. FETCH AND DISPLAY STORED BOOKINGS (WITH CANCELLATION)
  // ------------------------------------------------------------
  async function fetchAndDisplayBookings(isManualClick = false) {
    if (!bookingsTableBody) return;

    if (isManualClick && refreshBookingsBtn) {
      refreshBookingsBtn.disabled = true;
      refreshBookingsBtn.textContent = '🔄 Refreshing...';
    }

    try {
      const res = await apiFetch(`/api/bookings?t=${Date.now()}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        if (json.data.length === 0) {
          bookingsTableBody.innerHTML = `
            <tr>
              <td colspan="6" class="table-loading">No bookings found in database. Reserve a table above!</td>
            </tr>
          `;
        } else {
          bookingsTableBody.innerHTML = json.data.map(item => {
            const isCancelled = item.status === 'Cancelled';
            const statusClass = isCancelled ? 'cancelled' : 'confirmed';
            const statusLabel = isCancelled ? 'Cancelled ❌' : 'Confirmed ✅';

            return `
              <tr id="booking-row-${item._id}">
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td>${escapeHtml(item.date)} <br><small style="color:#64748b;">${escapeHtml(item.time)}</small></td>
                <td><span class="guest-badge">${escapeHtml(item.guests)} Guest${item.guests > 1 ? 's' : ''}</span></td>
                <td><span class="table-badge">Table #${item.tableNumber || 1}</span></td>
                <td><span class="badge-status ${statusClass}" id="status-badge-${item._id}">${statusLabel}</span></td>
                <td>
                  ${
                    isCancelled
                      ? '<span style="color:#94a3b8; font-size:0.85rem;">Cancelled</span>'
                      : `<button type="button" class="btn-action-cancel" onclick="cancelBooking('${item._id}')">Cancel</button>`
                  }
                </td>
              </tr>
            `;
          }).join('');
        }

        if (isManualClick && refreshBookingsBtn) {
          refreshBookingsBtn.textContent = '✅ Updated!';
          setTimeout(() => {
            refreshBookingsBtn.textContent = '🔄 Refresh';
            refreshBookingsBtn.disabled = false;
          }, 1200);
        }
      } else {
        bookingsTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="table-loading">Could not retrieve bookings from database.</td>
          </tr>
        `;
        if (isManualClick && refreshBookingsBtn) {
          refreshBookingsBtn.textContent = '🔄 Refresh';
          refreshBookingsBtn.disabled = false;
        }
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      bookingsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading">Database connection offline. Start server to view bookings.</td>
        </tr>
      `;
      if (isManualClick && refreshBookingsBtn) {
        refreshBookingsBtn.textContent = '❌ Failed';
        setTimeout(() => {
          refreshBookingsBtn.textContent = '🔄 Refresh';
          refreshBookingsBtn.disabled = false;
        }, 1500);
      }
    }
  }

  // ------------------------------------------------------------
  // 9. CANCEL BOOKING FUNCTION (Exposed to Global Scope)
  // ------------------------------------------------------------
  window.cancelBooking = async function (bookingId) {
    if (!bookingId) return;

    const confirmed = confirm('Are you sure you want to cancel this table reservation?');
    if (!confirmed) return;

    try {
      const response = await apiFetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('Booking has been cancelled successfully. The table is now available again.');
        // Refresh bookings and availability
        fetchAndDisplayBookings();
        fetchAvailability();
      } else {
        alert(result.message || 'Failed to cancel booking.');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      alert('Unable to cancel booking. Please check if the server is running.');
    }
  };

  if (refreshBookingsBtn) {
    refreshBookingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fetchAndDisplayBookings(true);
      fetchAvailability();
    });
  }

  // ------------------------------------------------------------
  // 10. CUSTOMER FEEDBACK & RATINGS
  // ------------------------------------------------------------

  // Rating labels helper
  const ratingDescriptions = {
    1: '1 out of 5 Stars (Poor)',
    2: '2 out of 5 Stars (Fair)',
    3: '3 out of 5 Stars (Good)',
    4: '4 out of 5 Stars (Very Good)',
    5: '5 out of 5 Stars (Excellent!)'
  };

  // Interactive Star Selector
  if (starRating) {
    const stars = starRating.querySelectorAll('.star');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.getAttribute('data-value'), 10);
        ratingValueInput.value = val;
        ratingLabel.textContent = ratingDescriptions[val] || `${val} Stars`;

        stars.forEach(s => {
          const sVal = parseInt(s.getAttribute('data-value'), 10);
          if (sVal <= val) {
            s.classList.add('selected');
          } else {
            s.classList.remove('selected');
          }
        });
      });
    });
  }

  // Submit Feedback Form
  if (reviewForm) {
    reviewName.addEventListener('input', () => clearError(reviewName, reviewNameError));
    reviewComment.addEventListener('input', () => clearError(reviewComment, reviewCommentError));

    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(reviewName, reviewNameError);
      clearError(reviewComment, reviewCommentError);
      hideMessage(reviewMessage);

      const name = reviewName.value.trim();
      const rating = parseInt(ratingValueInput.value, 10) || 5;
      const comment = reviewComment.value.trim();

      let hasError = false;
      if (!name || name.length < 2) {
        setError(reviewName, reviewNameError, 'Please enter your name.');
        hasError = true;
      }

      if (!comment || comment.length < 5) {
        setError(reviewComment, reviewCommentError, 'Please write at least a few words about your experience.');
        hasError = true;
      }

      if (hasError) return;

      submitReviewBtn.disabled = true;
      reviewBtnText.textContent = 'Submitting...';
      reviewSpinner.classList.remove('hidden');

      try {
        const res = await apiFetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, rating, comment })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          showMessage(reviewMessage, 'Thank you! Your feedback has been saved.', 'success');
          reviewForm.reset();
          ratingValueInput.value = 5;
          ratingLabel.textContent = ratingDescriptions[5];

          // Re-color all 5 stars
          if (starRating) {
            starRating.querySelectorAll('.star').forEach(s => s.classList.add('selected'));
          }

          // Reload reviews
          loadReviews();
        } else {
          showMessage(reviewMessage, data.message || 'Failed to submit review.', 'error');
        }
      } catch (err) {
        console.error('Review submit error:', err);
        showMessage(reviewMessage, 'Unable to submit feedback. Check server connection.', 'error');
      } finally {
        submitReviewBtn.disabled = false;
        reviewBtnText.textContent = 'Submit Feedback';
        reviewSpinner.classList.add('hidden');
      }
    });
  }

  // Load and Render Reviews from MongoDB
  async function loadReviews() {
    if (!reviewsList) return;

    try {
      const res = await apiFetch(`/api/reviews?t=${Date.now()}`);
      const json = await res.json();

      if (json.success) {
        // Update stats
        if (avgRatingScore) avgRatingScore.textContent = json.averageRating.toFixed(1);
        if (reviewsCount) reviewsCount.textContent = json.count;

        // Render average stars
        if (avgStarsDisplay) {
          const rounded = Math.round(json.averageRating || 5);
          avgStarsDisplay.textContent = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
        }

        // Render review cards
        if (json.data && json.data.length > 0) {
          reviewsList.innerHTML = json.data.map(r => {
            const dateStr = new Date(r.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            return `
              <div class="review-item">
                <div class="review-item-header">
                  <span class="reviewer-name">${escapeHtml(r.name)}</span>
                  <span class="review-date">${dateStr}</span>
                </div>
                <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                <p class="review-comment">${escapeHtml(r.comment)}</p>
              </div>
            `;
          }).join('');
        } else {
          reviewsList.innerHTML = `
            <p class="no-reviews">No reviews yet. Be the first to share your dining experience!</p>
          `;
        }
      }
    } catch (err) {
      console.error('Error loading reviews:', err);
      reviewsList.innerHTML = `
        <p class="no-reviews">Could not load customer reviews.</p>
      `;
    }
  }

  // ------------------------------------------------------------
  // INITIAL PAGE DATA LOAD
  // ------------------------------------------------------------
  fetchAvailability();
  fetchAndDisplayBookings(false);
  loadReviews();

});
