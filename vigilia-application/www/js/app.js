// Core UI Functions
function activatePanicMode() {
  try {
    if (window.vigiliaApp) {
      window.vigiliaApp.activatePanicMode();
    }
  } catch (e) {
    console.warn("vigiliaApp not available:", e);
  }

  // Apply panic mode visual feedback
  document.querySelector('.vigilia-dark-bg').classList.add('panic-active');

  // Show panic mode UI
  showPanicModeUI();
}

function showPanicModeUI() {
  // Check if overlay already exists to avoid duplicates
  if (document.getElementById('panic-overlay')) return;

  // Use existing panic-overlay from HTML instead of creating a new one
  const panicOverlay = document.getElementById('panic-overlay');
  if (panicOverlay) {
    panicOverlay.classList.add('active');
  }
}

function deactivatePanicMode() {
  const panicOverlay = document.getElementById('panic-overlay');
  if (panicOverlay) {
    panicOverlay.classList.remove('active');
  }

  // Reset background
  document.querySelector('.vigilia-dark-bg').classList.remove('panic-active');

  try {
    if (window.vigiliaApp) {
      window.vigiliaApp.panicMode = false;
    }
  } catch (e) {
    console.warn("vigiliaApp not available:", e);
  }
}

// Feature Modal Functions
function showFeatureModal(title, content) {
  // Remove existing modals to prevent stacking
  document.querySelectorAll('.modal').forEach(modal => modal.remove());

  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content" style="background: var(--card-bg); color: var(--light-color);">
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.07);">
          <h5 class="modal-title" style="color: var(--light-color);">${title}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.07);">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          <button type="button" class="btn btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();

  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
  });
}

function openContacts() {
  showFeatureModal('Emergency Contacts', `
    <div class="d-grid gap-2">
      <div class="d-flex justify-content-between align-items-center p-3 rounded" style="background: var(--card-bg); box-shadow: var(--card-shadow);">
        <div>
          <strong style="color: var(--light-color);">Emergency Services</strong><br>
          <small class="text-muted">911</small>
        </div>
        <button class="btn btn-sm btn-outline-primary">Edit</button>
      </div>
      <div class="d-flex justify-content-between align-items-center p-3 rounded" style="background: var(--card-bg); box-shadow: var(--card-shadow);">
        <div>
          <strong style="color: var(--light-color);">Family Contact</strong><br>
          <small class="text-muted">Not set</small>
        </div>
        <button class="btn btn-sm btn-outline-primary">Add</button>
      </div>
      <button class="btn btn-primary">Add New Contact</button>
    </div>
  `);
}

function openHealthInfo() {
  showFeatureModal('Medical Information', `
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Blood Type</label>
        <select class="form-select" style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);">
          <option style="color: var(--light-color);">Select...</option>
          <option style="color: var(--light-color);">A+</option>
          <option style="color: var(--light-color);">A-</option>
          <option style="color: var(--light-color);">B+</option>
          <option style="color: var(--light-color);">B-</option>
          <option style="color: var(--light-color);">AB+</option>
          <option style="color: var(--light-color);">AB-</option>
          <option style="color: var(--light-color);">O+</option>
          <option style="color: var(--light-color);">O-</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Allergies</label>
        <textarea class="form-control" rows="2" placeholder="List any allergies..." style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);"></textarea>
      </div>
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Medications</label>
        <textarea class="form-control" rows="2" placeholder="Current medications..." style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);"></textarea>
      </div>
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Emergency Medical Contact</label>
        <input type="text" class="form-control" placeholder="Doctor's name and phone" style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);">
      </div>
    </div>
  `);
}

function openEvidence() {
  showFeatureModal('Evidence Vault', `
    <div class="text-center py-4">
      <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
      <h5 style="color: var(--light-color);">Secure Evidence Storage</h5>
      <p class="text-muted">Photos, audio recordings, and location data are stored securely and encrypted.</p>
      <div class="d-grid gap-2 col-8 mx-auto">
        <button class="btn btn-outline-primary">View Photos</button>
        <button class="btn btn-outline-primary">View Audio</button>
        <button class="btn btn-outline-primary">Location History</button>
        <button class="btn btn-outline-danger">Export Evidence</button>
      </div>
    </div>
  `);
}

function openSettings() {
  showFeatureModal('Settings', `
    <div class="list-group">
      <div class="list-group-item d-flex justify-content-between align-items-center" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <span style="color: var(--light-color);">Auto-SOS Location Sharing</span>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" checked>
        </div>
      </div>
      <div class="list-group-item d-flex justify-content-between align-items-center" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <span style="color: var(--light-color);">Silent Panic Mode</span>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" checked>
        </div>
      </div>
      <div class="list-group-item d-flex justify-content-between align-items-center" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <span style="color: var(--light-color);">Location Tracking</span>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" checked>
        </div>
      </div>
      <div class="list-group-item d-flex justify-content-between align-items-center" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <span style="color: var(--light-color);">Auto-Record Evidence</span>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox">
        </div>
      </div>
    </div>
    <div class="mt-3 d-grid gap-2">
      <button class="btn btn-outline-primary">Backup Data</button>
      <button class="btn btn-outline-secondary">Export Settings</button>
      <button class="btn btn-outline-danger">Reset App</button>
    </div>
  `);
}

function openCyberSafety() {
  showFeatureModal('Cyber Safety', `
    <div class="row g-3">
      <div class="col-12">
        <div class="card" style="background: var(--card-bg); box-shadow: var(--card-shadow);">
          <div class="card-body text-center">
            <i class="fas fa-shield-alt fa-2x text-success mb-2"></i>
            <h6 style="color: var(--light-color);">Device Security Status</h6>
            <span class="badge bg-success">Secure</span>
          </div>
        </div>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-primary w-100">
          <i class="fas fa-wifi"></i><br>Network<br>Scan
        </button>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-warning w-100">
          <i class="fas fa-eye-slash"></i><br>Privacy<br>Check
        </button>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-info w-100">
          <i class="fas fa-lock"></i><br>Password<br>Manager
        </button>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-danger w-100">
          <i class="fas fa-bug"></i><br>Malware<br>Scan
        </button>
      </div>
    </div>
  `);
}

// Navigation Functions
function showHome() {
  setActiveNav(0);
}

function showHistory() {
  showFeatureModal('Activity History', `
    <div class="timeline">
      <div class="d-flex align-items-center mb-3">
        <div class="bg-success rounded-circle p-2 me-3">
          <i class="fas fa-map-marker-alt text-white"></i>
        </div>
        <div>
          <strong style="color: var(--light-color);">Location Shared</strong><br>
          <small class="text-muted">Today, 2:30 PM</small>
        </div>
      </div>
      <div class="d-flex align-items-center mb-3">
        <div class="bg-warning rounded-circle p-2 me-3">
          <i class="fas fa-camera text-white"></i>
        </div>
        <div>
          <strong style="color: var(--light-color);">Photo Captured</strong><br>
          <small class="text-muted">Yesterday, 8:15 AM</small>
        </div>
      </div>
      <div class="d-flex align-items-center mb-3">
        <div class="bg-danger rounded-circle p-2 me-3">
          <i class="fas fa-exclamation-triangle text-white"></i>
        </div>
        <div>
          <strong style="color: var(--light-color);">SOS Alert Sent</strong><br>
          <small class="text-muted">3 days ago, 11:45 PM</small>
        </div>
      </div>
    </div>
  `);
  setActiveNav(1);
}

function showProfile() {
  showFeatureModal('User Profile', `
    <div class="text-center mb-4">
      <div class="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px; background: var(--primary-color);">
        <i class="fas fa-user fa-2x text-white"></i>
      </div>
      <h5 class="mt-2" style="color: var(--light-color);">Vigilia User</h5>
    </div>
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Full Name</label>
        <input type="text" class="form-control" placeholder="Enter your name" style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);">
      </div>
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Phone Number</label>
        <input type="tel" class="form-control" placeholder="Your phone number" style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);">
      </div>
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Email Address</label>
        <input type="email" class="form-control" placeholder="Your email" style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);">
      </div>
      <div class="col-12">
        <label class="form-label" style="color: var(--light-color);">Emergency Contact</label>
        <input type="text" class="form-control" placeholder="Emergency contact name" style="background: var(--card-bg); color: var(--light-color); border-color: rgba(255,255,255,0.07);">
      </div>
    </div>
  `);
  setActiveNav(2);
}

function showHelp() {
  showFeatureModal('Help & Support', `
    <div class="accordion" id="helpAccordion">
      <div class="accordion-item" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <h2 class="accordion-header">
          <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#help1" style="background: var(--card-bg); color: var(--light-color);">
            How to send an SOS alert?
          </button>
        </h2>
        <div id="help1" class="accordion-collapse collapse show" data-bs-parent="#helpAccordion">
          <div class="accordion-body" style="color: var(--light-color);">
            Press the SOS button or press volume down 3 times quickly. Your location and alert will be sent to emergency contacts automatically.
          </div>
        </div>
      </div>
      <div class="accordion-item" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#help2" style="background: var(--card-bg); color: var(--light-color);">
            What is Panic Mode?
          </button>
        </h2>
        <div id="help2" class="accordion-collapse collapse" data-bs-parent="#helpAccordion">
          <div class="accordion-body" style="color: var(--light-color);">
            Panic Mode silently activates all safety features: SOS alerts, location tracking, and evidence recording. Activate by holding the panic button or using the volume button sequence.
          </div>
        </div>
      </div>
      <div class="accordion-item" style="background: var(--card-bg); border-color: rgba(255,255,255,0.07);">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#help3" style="background: var(--card-bg); color: var(--light-color);">
            How secure is my data?
          </button>
        </h2>
        <div id="help3" class="accordion-collapse collapse" data-bs-parent="#helpAccordion">
          <div class="accordion-body" style="color: var(--light-color);">
            All evidence and personal data is encrypted and stored securely on your device. Location data is only shared during emergencies with your designated contacts.
          </div>
        </div>
      </div>
    </div>
    <div class="mt-4 d-grid gap-2">
      <button class="btn btn-outline-primary">Contact Support</button>
      <button class="btn btn-outline-secondary">User Manual</button>
    </div>
  `);
  setActiveNav(3);
}

function setActiveNav(index) {
  document.querySelectorAll('.nav-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });
}

// Utility Functions
function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    timeDisplay.textContent = timeString;
  }
}

function setupPanicButton() {
  const panicButton = document.querySelector('.panic-button');
  if (!panicButton) return;

  let holdTimer;

  panicButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    holdTimer = setTimeout(() => {
      activatePanicMode();
    }, 1000);
  });

  panicButton.addEventListener('touchend', () => {
    clearTimeout(holdTimer);
  });

  panicButton.addEventListener('touchcancel', () => {
    clearTimeout(holdTimer);
  });

  // Support for mouse events (for desktop testing)
  panicButton.addEventListener('mousedown', (e) => {
    e.preventDefault();
    holdTimer = setTimeout(() => {
      activatePanicMode();
    }, 1000);
  });

  panicButton.addEventListener('mouseup', () => {
    clearTimeout(holdTimer);
  });

  panicButton.addEventListener('mouseleave', () => {
    clearTimeout(holdTimer);
  });
}

// Quick Action Functions
function sendSOS() {
  console.log('SOS alert sent');
  // Placeholder for actual SOS functionality
}

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log(`Location: ${position.coords.latitude}, ${position.coords.longitude}`);
        // Placeholder for sharing location
      },
      (error) => {
        console.error('Location error:', error);
        alert('Unable to access location. Please enable GPS.');
      }
    );
  } else {
    alert('Geolocation is not supported by this device.');
  }
}

function capturePhoto() {
  console.log('Capturing photo');
  // Placeholder for camera functionality
}

function recordAudio() {
  console.log('Recording audio');
  // Placeholder for audio recording
}

function startLocationTracking() {
  console.log('Starting live tracking');
  // Placeholder for live tracking functionality
}

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  setInterval(updateTime, 1000);
  setupPanicButton();

  function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    const locationEl = document.getElementById('location-status');

    if (statusEl) {
      statusEl.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
    }

    if (locationEl && navigator.geolocation) {
      locationEl.textContent = '📍 GPS Ready';
    } else {
      locationEl.textContent = '📍 GPS Unavailable';
    }
  }

  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
});