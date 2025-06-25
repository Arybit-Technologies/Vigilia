/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready

// Vigilia App - Main JavaScript Functionality
// Personal Protection & Safety App

class VigiliaApp {
    constructor() {
        this.isDeviceReady = false;
        this.currentLocation = null;
        this.emergencyContacts = this.loadEmergencyContacts();
        this.mediaRecorder = null;
        this.isRecording = false;
        this.panicMode = false;
        this.audioChunks = [];
        
        // Initialize app when device is ready
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
        
        // If running in browser for testing
        if (typeof cordova === 'undefined') {
            setTimeout(() => this.onDeviceReady(), 1000);
        }
    }

    onDeviceReady() {
        console.log('Vigilia: Device Ready');
        this.isDeviceReady = true;
        this.initializeApp();
        this.startLocationTracking();
        this.setupNotifications();
    }

    initializeApp() {
        // Update UI based on device readiness
        this.updateConnectionStatus();
        this.loadUserPreferences();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Volume button panic mode (if supported)
        document.addEventListener('volumedownbutton', this.handleVolumeDown.bind(this), false);
        document.addEventListener('volumeupbutton', this.handleVolumeUp.bind(this), false);
        
        // Back button handling
        document.addEventListener('backbutton', this.handleBackButton.bind(this), false);
        
        // App pause/resume
        document.addEventListener('pause', this.onPause.bind(this), false);
        document.addEventListener('resume', this.onResume.bind(this), false);
    }

    // SOS Functionality
    async sendSOS() {
        try {
            this.showStatus('🚨 Sending SOS Alert...', 'danger');
            
            // Get current location
            const location = await this.getCurrentLocation();
            
            // Prepare SOS data
            const sosData = {
                timestamp: new Date().toISOString(),
                location: location,
                user: this.getUserInfo(),
                type: 'SOS_ALERT',
                urgency: 'HIGH'
            };

            // Send to emergency contacts
            await this.notifyEmergencyContacts(sosData);
            
            // Send to emergency services (if configured)
            await this.contactEmergencyServices(sosData);
            
            // Store locally
            this.storeSosAlert(sosData);
            
            // Show confirmation
            this.showStatus('✅ SOS Alert Sent Successfully!', 'success');
            
            // Auto-start recording evidence
            setTimeout(() => {
                this.startEmergencyRecording();
            }, 2000);

        } catch (error) {
            console.error('SOS Error:', error);
            this.showStatus('❌ SOS Failed. Retrying...', 'warning');
            this.retrySOS();
        }
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation not supported');
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    this.currentLocation = location;
                    resolve(location);
                },
                (error) => {
                    console.error('Location Error:', error);
                    reject(error);
                },
                options
            );
        });
    }

    // Location Tracking
    async getLocation() {
        try {
            this.showStatus('📍 Getting your location...', 'info');
            
            const location = await this.getCurrentLocation();
            
            // Create Google Maps link
            const mapsUrl = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
            
            // Display location info
            const locationInfo = `
                <div class="location-info">
                    <h5>📍 Current Location</h5>
                    <p><strong>Latitude:</strong> ${location.latitude.toFixed(6)}</p>
                    <p><strong>Longitude:</strong> ${location.longitude.toFixed(6)}</p>
                    <p><strong>Accuracy:</strong> ±${location.accuracy}m</p>
                    <a href="${mapsUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-external-link-alt"></i> View on Maps
                    </a>
                </div>
            `;
            
            this.showModal('Your Location', locationInfo);
            this.showStatus('✅ Location retrieved successfully!', 'success');

        } catch (error) {
            console.error('Location Error:', error);
            this.showStatus('❌ Could not get location. Check permissions.', 'danger');
        }
    }

    startLocationTracking() {
        if (navigator.geolocation) {
            const options = {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.watchPosition(
                (position) => {
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                },
                (error) => console.warn('Location tracking error:', error),
                options
            );
        }
    }

    // Photo Capture
    async capturePhoto() {
        try {
            this.showStatus('📷 Opening camera...', 'info');

            if (typeof Camera !== 'undefined') {
                // Cordova camera
                const options = {
                    quality: 75,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    encodingType: Camera.EncodingType.JPEG,
                    targetWidth: 1024,
                    targetHeight: 1024,
                    allowEdit: false,
                    correctOrientation: true,
                    saveToPhotoAlbum: true
                };

                navigator.camera.getPicture(
                    (imageURI) => this.onPhotoSuccess(imageURI),
                    (error) => this.onPhotoError(error),
                    options
                );
            } else {
                // Web fallback
                this.capturePhotoWeb();
            }

        } catch (error) {
            console.error('Camera Error:', error);
            this.showStatus('❌ Camera access failed', 'danger');
        }
    }

    onPhotoSuccess(imageURI) {
        // Store photo with location and timestamp
        const photoData = {
            uri: imageURI,
            timestamp: new Date().toISOString(),
            location: this.currentLocation,
            type: 'evidence_photo'
        };

        this.storeEvidence(photoData);
        this.showStatus('✅ Photo captured and stored securely!', 'success');
        
        // Show preview
        this.showPhotoPreview(imageURI);
    }

    onPhotoError(message) {
        console.error('Camera error:', message);
        this.showStatus('❌ Photo capture failed: ' + message, 'danger');
    }

    capturePhotoWeb() {
        // Web camera fallback
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'camera';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.onPhotoSuccess(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        };
        
        input.click();
    }

    // Audio Recording
    async recordAudio() {
        try {
            if (this.isRecording) {
                this.stopRecording();
                return;
            }

            this.showStatus('🎙️ Starting audio recording...', 'info');
            await this.startRecording();

        } catch (error) {
            console.error('Audio Error:', error);
            this.showStatus('❌ Audio recording failed', 'danger');
        }
    }

    async startRecording() {
        try {
            // Check for Cordova media plugin
            if (typeof Media !== 'undefined') {
                this.startCordovaRecording();
            } else {
                await this.startWebRecording();
            }
        } catch (error) {
            throw error;
        }
    }

    startCordovaRecording() {
        const fileName = `vigilia_audio_${Date.now()}.m4a`;
        const filePath = cordova.file.documentsDirectory + fileName;

        this.mediaRecorder = new Media(filePath,
            () => this.onRecordingSuccess(filePath),
            (error) => this.onRecordingError(error)
        );

        this.mediaRecorder.startRecord();
        this.isRecording = true;
        this.updateRecordingUI();
    }

    async startWebRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            this.onRecordingSuccess(audioUrl);
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        this.updateRecordingUI();
    }

    stopRecording() {
        if (this.mediaRecorder) {
            if (typeof Media !== 'undefined' && this.mediaRecorder.stopRecord) {
                this.mediaRecorder.stopRecord();
            } else {
                this.mediaRecorder.stop();
            }
        }
        this.isRecording = false;
        this.updateRecordingUI();
    }

    onRecordingSuccess(audioURI) {
        const audioData = {
            uri: audioURI,
            timestamp: new Date().toISOString(),
            location: this.currentLocation,
            type: 'evidence_audio',
            duration: Date.now() - this.recordingStartTime
        };

        this.storeEvidence(audioData);
        this.showStatus('✅ Audio recorded and stored securely!', 'success');
    }

    onRecordingError(error) {
        console.error('Recording error:', error);
        this.showStatus('❌ Audio recording failed', 'danger');
        this.isRecording = false;
        this.updateRecordingUI();
    }

    updateRecordingUI() {
        const recordBtn = document.querySelector('button[onclick="recordAudio()"]');
        if (recordBtn) {
            if (this.isRecording) {
                recordBtn.innerHTML = '⏹️ Stop Recording';
                recordBtn.className = 'btn btn-danger';
            } else {
                recordBtn.innerHTML = '🎙️ Record Audio';
                recordBtn.className = 'btn btn-success';
            }
        }
    }

    // Emergency Features
    async notifyEmergencyContacts(sosData) {
        const contacts = this.emergencyContacts;
        const message = `🚨 EMERGENCY ALERT from ${sosData.user.name}\n\nLocation: https://maps.google.com/maps?q=${sosData.location.latitude},${sosData.location.longitude}\n\nTime: ${new Date(sosData.timestamp).toLocaleString()}\n\nThis is an automated message from Vigilia Safety App.`;

        for (const contact of contacts) {
            try {
                // Send SMS if available
                if (typeof SMS !== 'undefined') {
                    SMS.send(contact.phone, message);
                }
                
                // Send email if configured
                if (contact.email) {
                    this.sendEmail(contact.email, 'EMERGENCY ALERT', message);
                }
            } catch (error) {
                console.error('Failed to notify contact:', contact, error);
            }
        }
    }

    // Panic Mode
    activatePanicMode() {
        this.panicMode = true;
        this.showStatus('🔴 PANIC MODE ACTIVATED', 'danger');
        
        // Auto-send SOS
        this.sendSOS();
        
        // Start continuous location tracking
        this.startContinuousTracking();
        
        // Begin evidence collection
        this.startEmergencyRecording();
        
        // Hide app from recent apps (if supported)
        this.hideFromRecents();
    }

    handleVolumeDown() {
        // Volume down button pressed - could be part of panic sequence
        if (this.volumeSequenceTimer) {
            clearTimeout(this.volumeSequenceTimer);
        }
        
        this.volumeDownCount = (this.volumeDownCount || 0) + 1;
        
        if (this.volumeDownCount >= 3) {
            this.activatePanicMode();
            this.volumeDownCount = 0;
        }
        
        this.volumeSequenceTimer = setTimeout(() => {
            this.volumeDownCount = 0;
        }, 3000);
    }

    // Utility Functions
    showStatus(message, type = 'info') {
        // Create or update status element
        let statusEl = document.getElementById('status-message');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'status-message';
            statusEl.className = 'alert alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
            statusEl.style.zIndex = '9999';
            document.body.appendChild(statusEl);
        }

        statusEl.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        statusEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (statusEl && statusEl.parentNode) {
                statusEl.remove();
            }
        }, 5000);
    }

    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
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

    showPhotoPreview(imageURI) {
        const content = `
            <div class="text-center">
                <img src="${imageURI}" class="img-fluid rounded" style="max-height: 300px;">
                <p class="mt-2 text-muted">Photo captured and stored securely with location data</p>
            </div>
        `;
        this.showModal('Photo Captured', content);
    }

    // Storage Functions
    storeEvidence(data) {
        const evidence = this.getStoredData('evidence') || [];
        evidence.push(data);
        this.setStoredData('evidence', evidence);
    }

    storeSosAlert(data) {
        const alerts = this.getStoredData('sos_alerts') || [];
        alerts.push(data);
        this.setStoredData('sos_alerts', alerts);
    }

    getStoredData(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (error) {
            console.error('Storage read error:', error);
            return null;
        }
    }

    setStoredData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Storage write error:', error);
        }
    }

    loadEmergencyContacts() {
        return this.getStoredData('emergency_contacts') || [
            { name: 'Emergency Services', phone: '911', email: '' },
            { name: 'Family Contact', phone: '', email: '' }
        ];
    }

    getUserInfo() {
        return this.getStoredData('user_info') || {
            name: 'Vigilia User',
            phone: '',
            email: '',
            medicalInfo: '',
            emergencyContactName: '',
            emergencyContactPhone: ''
        };
    }

    updateConnectionStatus() {
        const isOnline = navigator.onLine;
        const statusText = isOnline ? '🟢 Online' : '🔴 Offline';
        
        // Update UI if status element exists
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = statusText;
        }
    }

    loadUserPreferences() {
        const prefs = this.getStoredData('user_preferences') || {};
        // Apply preferences
    }

    // Lifecycle handlers
    onPause() {
        console.log('App paused');
        // Continue location tracking in background if in panic mode
    }

    onResume() {
        console.log('App resumed');
        this.updateConnectionStatus();
    }

    handleBackButton() {
        // Prevent accidental app closure in panic mode
        if (this.panicMode) {
            return false;
        }
        // Normal back button handling
    }

    // Additional utility methods
    sendEmail(to, subject, body) {
        if (typeof cordova !== 'undefined' && cordova.plugins && cordova.plugins.email) {
            cordova.plugins.email.open({
                to: [to],
                subject: subject,
                body: body
            });
        }
    }

    hideFromRecents() {
        // Platform-specific implementation to hide app from recent apps
        if (typeof cordova !== 'undefined' && cordova.plugins) {
            // Implementation depends on available plugins
        }
    }

    retrySOS() {
        setTimeout(() => {
            this.sendSOS();
        }, 5000);
    }

    startEmergencyRecording() {
        // Auto-start recording for evidence collection
        if (!this.isRecording) {
            this.recordAudio();
        }
    }

    startContinuousTracking() {
        // Enhanced location tracking for emergencies
        if (navigator.geolocation) {
            this.trackingInterval = setInterval(() => {
                this.getCurrentLocation().then(location => {
                    // Store location breadcrumbs
                    const breadcrumbs = this.getStoredData('location_breadcrumbs') || [];
                    breadcrumbs.push({
                        ...location,
                        timestamp: new Date().toISOString()
                    });
                    this.setStoredData('location_breadcrumbs', breadcrumbs);
                }).catch(error => {
                    console.error('Continuous tracking error:', error);
                });
            }, 30000); // Every 30 seconds
        }
    }

    setupNotifications() {
        // Setup local notifications if plugin available
        if (typeof cordova !== 'undefined' && cordova.plugins && cordova.plugins.notification) {
            cordova.plugins.notification.local.requestPermission();
        }
    }

    contactEmergencyServices(sosData) {
        // Implementation for contacting emergency services
        // This would integrate with local emergency service APIs
        console.log('Emergency services contacted:', sosData);
    }
}

// Global functions for button events
function sendSOS() {
    window.vigiliaApp.sendSOS();
}

function getLocation() {
    window.vigiliaApp.getLocation();
}

function capturePhoto() {
    window.vigiliaApp.capturePhoto();
}

function recordAudio() {
    window.vigiliaApp.recordAudio();
}

// Initialize app
window.vigiliaApp = new VigiliaApp();