// Enhanced UI Functions
function activatePanicMode() {
  if (window.vigiliaApp) {
    window.vigiliaApp.activatePanicMode();
  }
   
  // Visual feedback
  document.body.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
  
  // Show panic mode indicator
  showPanicModeUI();
}

function showPanicModeUI() {
  const panicOverlay = document.createElement('div');
  panicOverlay.id = 'panic-overlay';
  panicOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(220, 53, 69, 0.9);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-size: 2rem;
    font-weight: bold;
  `;
  
  panicOverlay.innerHTML = `
    <div>🚨 PANIC MODE ACTIVE 🚨</div>
    <div style="font-size: 1rem; margin-top: 20px;">
      Emergency contacts notified<br>
      Location being tracked<br>
      Evidence recording started
    </div>
    <button onclick="deactivatePanicMode()" style="
      margin-top: 30px;
      padding: 15px 30px;
      background: white;
      color: #dc3545;
      border: none;
      border-radius: 10px;
      font-weight: bold;
      cursor: pointer;
    ">Deactivate Panic Mode</button>
  `;
  
  document.body.appendChild(panicOverlay);
}

function deactivatePanicMode() {
  const overlay = document.getElementById('panic-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  // Reset background
  document.body.style.background = '';
  
  if (window.vigiliaApp) {
    window.vigiliaApp.panicMode = false;
  }
}

function openContacts() {
  showFeatureModal('Emergency Contacts', `
    <div class="d-grid gap-2">
      <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded">
        <div>
          <strong>Emergency Services</strong><br>
          <small class="text-muted">911</small>
        </div>
        <button class="btn btn-sm btn-outline-primary">Edit</button>
      </div>
      <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded">
        <div>
          <strong>Family Contact</strong><br>
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
        <label class="form-label">Blood Type</label>
        <select class="form-select">
          <option>Select...</option>
          <option>A+</option>
          <option>A-</option>
          <option>B+</option>
          <option>B-</option>
          <option>AB+</option>
          <option>AB-</option>
          <option>O+</option>
          <option>O-</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label">Allergies</label>
        <textarea class="form-control" rows="2" placeholder="List any allergies..."></textarea>
      </div>
      <div class="col-12">
        <label class="form-label">Medications</label>
        <textarea class="form-control" rows="2" placeholder="Current medications..."></textarea>
      </div>
      <div class="col-12">
        <label class="form-label">Emergency Medical Contact</label>
        <input type="text" class="form-control" placeholder="Doctor's name and phone">
      </div>
    </div>
  `);
}

function openEvidence() {
  showFeatureModal('Evidence Vault', `
    <div class="text-center py-4">
      <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
      <h5>Secure Evidence Storage</h5>
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
      <div class="list-group-item d-flex justify-content-between align-items-center">
        Auto-SOS Location Sharing
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" checked>
        </div>
      </div>
      <div class="list-group-item d-flex justify-content-between align-items-center">
        Silent Panic Mode
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" checked>
        </div>
      </div>
      <div class="list-group-item d-flex justify-content-between align-items-center">
        Location Tracking
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" checked>
        </div>
      </div>
      <div class="list-group-item d-flex justify-content-between align-items-center">
        Auto-Record Evidence
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
        <div class="card">
          <div class="card-body text-center">
            <i class="fas fa-shield-alt fa-2x text-success mb-2"></i>
            <h6>Device Security Status</h6>
            <span class="badge bg-success">Secure</span>
          </div>
        </div>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-primary w-100">
          <i class="fas fa-wifi"></i><br>
          Network<br>Scan
        </button>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-warning w-100">
          <i class="fas fa-eye-slash"></i><br>
          Privacy<br>Check
        </button>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-info w-100">
          <i class="fas fa-lock"></i><br>
          Password<br>Manager
        </button>
      </div>
      <div class="col-6">
        <button class="btn btn-outline-danger w-100">
          <i class="fas fa-bug"></i><br>
          Malware<br>Scan
        </button>
      </div>
    </div>
  `);
}

function showFeatureModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">${title}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
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

// Navigation functions
function showHome() {
  // Implementation for home view
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
          <strong>Location Shared</strong><br>
          <small class="text-muted">Today, 2:30 PM</small>
        </div>
      </div>
      <div class="d-flex align-items-center mb-3">
        <div class="bg-warning rounded-circle p-2 me-3">
          <i class="fas fa-camera text-white"></i>
        </div>
        <div>
          <strong>Photo Captured</strong><br>
          <small class="text-muted">Yesterday, 8:15 AM</small>
        </div>
      </div>
      <div class="d-flex align-items-center mb-3">
        <div class="bg-danger rounded-circle p-2 me-3">
          <i class="fas fa-exclamation-triangle text-white"></i>
        </div>
        <div>
          <strong>SOS Alert Sent</strong><br>
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
      <div class="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
        <i class="fas fa-user fa-2x text-white"></i>
      </div>
      <h5 class="mt-2">Vigilia User</h5>
    </div>
    <div class="row g-3">
      <div class="col-12">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-control" placeholder="Enter your name">
      </div>
      <div class="col-12">
        <label class="form-label">Phone Number</label>
        <input type="tel" class="form-control" placeholder="Your phone number">
      </div>
      <div class="col-12">
        <label class="form-label">Email Address</label>
        <input type="email" class="form-control" placeholder="Your email">
      </div>
      <div class="col-12">
        <label class="form-label">Emergency Contact</label>
        <input type="text" class="form-control" placeholder="Emergency contact name">
      </div>
    </div>
  `);
  setActiveNav(2);
}

function showHelp() {
  showFeatureModal('Help & Support', `
    <div class="accordion" id="helpAccordion">
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#help1">
            How to send an SOS alert?
          </button>
        </h2>
        <div id="help1" class="accordion-collapse collapse show" data-bs-parent="#helpAccordion">
          <div class="accordion-body">
            Press the SOS button or press volume down 3 times quickly. Your location and alert will be sent to emergency contacts automatically.
          </div>
        </div>
      </div>
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#help2">
            What is Panic Mode?
          </button>
        </h2>
        <div id="help2" class="accordion-collapse collapse" data-bs-parent="#helpAccordion">
          <div class="accordion-body">
            Panic Mode silently activates all safety features: SOS alerts, location tracking, and evidence recording. Activate by holding the panic button or using the volume button sequence.
          </div>
        </div>
      </div>
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#help3">
            How secure is my data?
          </button>
        </h2>
        <div id="help3" class="accordion-collapse collapse" data-bs-parent="#helpAccordion">
          <div class="accordion-body">
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
    if (i === index) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Update time display
function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    timeDisplay.textContent = timeString;
  }
}

// Initialize UI
document.addEventListener('DOMContentLoaded', function() {
  updateTime();
  setInterval(updateTime, 1000);
  
  // Update connection status
  function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    const locationEl = document.getElementById('location-status');
    
    if (statusEl) {
      statusEl.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
    }
    
    if (locationEl && navigator.geolocation) {
      locationEl.textContent = '📍 GPS Ready';
    }
  }
  
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
});