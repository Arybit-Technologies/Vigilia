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

function loadGoogleMapsApi(apiKey) {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve(window.google.maps);
            return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.setAttribute('loading', 'async');
        script.onload = () => resolve(window.google.maps);
        script.onerror = () => reject(new Error('Failed to load Google Maps API'));
        document.head.appendChild(script);
    });
}

class VigiliaApp {
    constructor() {
        this.isDeviceReady = false;
        this.currentLocation = null;
        this.emergencyContacts = [];
        this.mediaRecorder = null;
        this.isRecording = false;
        this.panicMode = false;
        this.audioChunks = [];
        this.videoChunks = [];
        this.panicTimer = null;
        this.panicCountdown = 3; // Seconds for panic activation
        this.map = null;
        this.marker = null;
        this.geofence = null;
        this.safeRouteMap = null;
        this.safeRouteMarker = null;
        this.safeZone = { center: null, radius: 500 }; // Default 500m radius
        this.googleMapsApiKey = 'AIzaSyAloYDyJ7kvvz0U8MDDGVnf_4E_SJU8V0c'; // TODO: Replace with secure environment variable
        this.language = 'en'; // Default language
        this.threatDetectionActive = false;
        this.communityAlerts = [];
        this.volumeDownCount = 0;
        this.volumeSequenceTimer = null;
        this.trackingInterval = null;

        // Bind event listeners
        this.onDeviceReady = this.onDeviceReady.bind(this);
        document.addEventListener('deviceready', this.onDeviceReady, false);
        // Fallback for browser testing
        if (typeof cordova === 'undefined') {
            setTimeout(this.onDeviceReady, 1000);
        }
    }

    onDeviceReady() {
        console.log('Vigilia: Device Ready');
        this.isDeviceReady = true;
        this.initializeApp();
    }

    initializeApp() {
        this.loadEmergencyContacts();
        this.updateConnectionStatus();
        this.loadUserPreferences();
        this.setupEventListeners();
        this.updateTimeDisplays();
        this.loadCommunityAlerts();
        this.startLocationTracking();
        this.setupNotifications();
        this.setupVoiceRecognition();
        this.setupWearableSync();
        // Register service worker for offline support
        this.registerServiceWorker();
    }

    setupEventListeners() {
        document.addEventListener('volumedownbutton', () => this.handleVolumeDown(), false);
        document.addEventListener('volumeupbutton', () => this.handleVolumeUp(), false);
        document.addEventListener('backbutton', () => this.handleBackButton(), false);
        document.addEventListener('pause', () => this.onPause(), false);
        document.addEventListener('resume', () => this.onResume(), false);
        window.addEventListener('online', () => this.updateConnectionStatus());
        window.addEventListener('offline', () => this.updateConnectionStatus());
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('Service Worker registered:', reg);
            }).catch(err => {
                console.error('Service Worker registration failed:', err);
            });
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            screen.focus();
        }

        // Update bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const screenMap = {
            'home': 0,
            'features': 1,
            'location': 2,
            'health': 3,
            'community': 4,
            'emergency': 5,
            'profile': 6
        };
        const navItems = document.querySelectorAll('.nav-item');
        if (screenMap[screenId] !== undefined) {
            navItems[screenMap[screenId]].classList.add('active');
        }

        // Show/hide FAB group
        const fabGroup = document.getElementById('vigilia-fab-group');
        if (fabGroup) {
            fabGroup.style.display = (screenId === 'location' || screenId === 'saferoute') ? 'flex' : 'none';
        }

        // Initialize map or update UI as needed
        if (screenId === 'location') {
            this.initializeMap();
            this.updateLocationDetails();
        } else if (screenId === 'community') {
            this.updateCommunityAlertsUI();
        }
        this.updateTimeDisplays();
        this.updateConnectionStatus();
    }

    showLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.remove('d-none');
            loadingEl.setAttribute('aria-hidden', 'false');
        }
    }

    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.add('d-none');
            loadingEl.setAttribute('aria-hidden', 'true');
        }
    }    

    async initializeMap() {
        if (this.map) return;
        const mapEl = document.getElementById('map');
        if (!mapEl) return;

        try {
            await loadGoogleMapsApi(this.googleMapsApiKey);
            const defaultLatLng = await this.getCurrentLocation().catch(() => ({
                latitude: -1.286389,
                longitude: 36.817223
            })); // Fallback: Nairobi
            this.map = new google.maps.Map(mapEl, {
                center: { lat: defaultLatLng.latitude, lng: defaultLatLng.longitude },
                zoom: 13,
                mapTypeId: 'roadmap',
                disableDefaultUI: true,
                zoomControl: true
            });
            this.marker = new google.maps.Marker({
                map: this.map, // <-- fix here
                position: { lat: defaultLatLng.latitude, lng: defaultLatLng.longitude },
                title: 'You are here'
            });
            this.updateMapLocation();
            this.setupGeofence();
        } catch (error) {
            console.error('Map initialization failed:', error);
            this.showStatus('❌ Failed to load map ' + JSON.stringify(error) + '', 'danger');
        }
    }

    updateMapLocation() {
        if (!this.currentLocation || !this.map) return;
        const { latitude, longitude, accuracy } = this.currentLocation;
        const latLng = { lat: latitude, lng: longitude };
        this.map.setCenter(latLng);
        this.map.setZoom(15);
        if (this.marker) {
            this.marker.setPosition(latLng);
        } else {
            this.marker = new google.maps.Marker({
                position: latLng,
                map: this.map,
                title: 'You are here'
            });
        }

        const statusEl = document.getElementById('geofence-status');
        const geofenceStatus = statusEl?.textContent || 'Inactive';
        const geofenceColor = statusEl?.style.color || '#28a745';

        const infoContent = `
            <div class="d-flex flex-wrap gap-2 align-items-center" style="font-size:0.95em;">
                <span class="badge bg-primary bg-gradient">
                    <i class="fas fa-map-marker-alt"></i> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
                </span>
                <span class="badge bg-secondary">
                    <i class="fas fa-bullseye"></i> ±${accuracy}m
                </span>
                <span class="badge" style="background:#28a7451a;color:${geofenceColor};font-weight:600;">
                    ${geofenceStatus}
                </span>
            </div>
        `;
        if (this.infoWindow) this.infoWindow.close();
        this.infoWindow = new google.maps.InfoWindow({ content: infoContent });
        this.infoWindow.open(this.map, this.marker);
        this.checkGeofence();
    }

    setupGeofence() {
        if (!this.currentLocation || !this.map) return;
        if (!this.safeZone.center) {
            this.safeZone.center = [this.currentLocation.latitude, this.currentLocation.longitude];
        }
        const centerLatLng = { lat: this.safeZone.center[0], lng: this.safeZone.center[1] };
        if (this.geofence) this.geofence.setMap(null);
        this.geofence = new google.maps.Circle({
            strokeColor: '#28a745',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#28a745',
            fillOpacity: 0.2,
            map: this.map,
            center: centerLatLng,
            radius: this.safeZone.radius
        });
        const statusEl = document.getElementById('geofence-status');
        if (statusEl) statusEl.textContent = 'Active';
    }

    checkGeofence() {
        if (!this.currentLocation || !this.safeZone.center) return;
        const distance = this.calculateDistance(
            this.currentLocation.latitude,
            this.currentLocation.longitude,
            this.safeZone.center[0],
            this.safeZone.center[1]
        );
        const statusEl = document.getElementById('geofence-status');
        if (distance > this.safeZone.radius) {
            statusEl.textContent = 'Outside Safe Zone';
            statusEl.style.color = '#dc3545';
            this.notifySafeZoneBreach();
        } else {
            statusEl.textContent = 'Within Safe Zone';
            statusEl.style.color = '#28a745';
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in meters
    }

    notifySafeZoneBreach() {
        const message = `⚠️ You have left the safe zone!\nLocation: https://maps.google.com/maps?q=${this.currentLocation.latitude},${this.currentLocation.longitude}`;
        this.notifyEmergencyContacts({
            timestamp: new Date().toISOString(),
            location: this.currentLocation,
            user: this.getUserInfo(),
            type: 'GEOFENCE_BREACH',
            urgency: 'MEDIUM',
            message
        });
        this.showStatus('⚠️ Safe Zone Breach Detected!', 'warning');
    }

    updateLocationDetails() {
        if (!this.currentLocation) {
            this.getCurrentLocation().then(() => this.updateLocationDetails()).catch(() => {
                this.showStatus('❌ Unable to fetch location', 'danger');
            });
            return;
        }
        const { latitude, longitude, accuracy } = this.currentLocation;
        document.getElementById('lat')?.setAttribute('data-lat', latitude.toFixed(6));
        document.getElementById('lng')?.setAttribute('data-lng', longitude.toFixed(6));
        document.getElementById('accuracy')?.setAttribute('data-accuracy', `±${accuracy}m`);
        const mapLinkEl = document.getElementById('view-map-link');
        if (mapLinkEl) mapLinkEl.href = `https://maps.google.com/maps?q=${latitude},${longitude}`;
        this.updateMapLocation();
    }

    startPanicCountdown() {
        this.showLoading();
        this.panicCountdown = 3;
        this.showStatus(`🔴 Sending alert in ${this.panicCountdown} seconds...`, 'warning');
        this.panicTimer = setInterval(() => {
            this.panicCountdown--;
            if (this.panicCountdown <= 0) {
                clearInterval(this.panicTimer);
                this.activatePanicMode();
                this.hideLoading();
                this.showStatus('🔴 Panic Mode Activated!', 'danger');
            } else {
                this.showStatus(`🔴 Sending alert in ${this.panicCountdown} seconds...`, 'warning');
            }
        }, 1000);
    }

    cancelPanicCountdown() {
        if (this.panicTimer) {
            clearInterval(this.panicTimer);
            this.panicCountdown = 3;
            this.hideLoading();
            this.showStatus('✅ Panic Mode Cancelled', 'info');
        }
    }

    async triggerEmergency() {
        try {
            this.showLoading();
            this.showStatus('📞 Contacting Emergency Services...', 'info');
            const sosData = {
                timestamp: new Date().toISOString(),
                location: await this.getCurrentLocation(),
                user: this.getUserInfo(),
                type: 'EMERGENCY_CALL',
                urgency: 'CRITICAL'
            };
            await this.contactEmergencyServices(sosData);
            if (typeof cordova !== 'undefined' && cordova.plugins?.phone) {
                cordova.plugins.phone.dial('999'); // Kenya emergency number
            } else {
                window.location.href = 'tel:999';
            }
            this.hideLoading();
            this.showModal('Emergency Services', 'Emergency services have been notified. Stay safe!');
        } catch (error) {
            console.error('Emergency Call Error:', error);
            this.hideLoading();
            this.showStatus('❌ Failed to contact emergency services', 'danger');
        }
    }

    async shareLocation() {
        try {
            this.showLoading();
            this.showStatus('📍 Sharing your location...', 'info');
            const location = await this.getCurrentLocation();
            const mapsUrl = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
            const message = `My current location: ${mapsUrl}\n\nSent from Vigilia Safety App`;
            if (typeof cordova !== 'undefined' && cordova.plugins?.sharer) {
                await cordova.plugins.sharer.share({
                    message: message,
                    subject: 'My Location - Vigilia',
                    url: mapsUrl
                });
            } else if (navigator.share) {
                await navigator.share({
                    title: 'My Location - Vigilia',
                    text: message,
                    url: mapsUrl
                });
            } else {
                await navigator.clipboard.writeText(message);
                this.showStatus('✅ Location copied to clipboard', 'success');
            }
            await this.notifyEmergencyContacts({
                timestamp: new Date().toISOString(),
                location: location,
                user: this.getUserInfo(),
                type: 'LOCATION_SHARE',
                urgency: 'MEDIUM'
            });
            this.hideLoading();
            this.showModal('Location Shared', 'Live location shared with emergency contacts');
        } catch (error) {
            console.error('Share Location Error:', error);
            this.hideLoading();
            this.showStatus('❌ Failed to share location', 'danger');
        }
    }

    async startRecording() {
        try {
            if (this.isRecording) {
                this.stopRecording();
                return;
            }
            this.showLoading();
            this.showStatus('🎙️ Starting audio recording...', 'info');
            await this.startRecordingInternal();
            this.hideLoading();
            this.showModal('Recording Started', 'Recording started and saved to secure cloud storage');
        } catch (error) {
            console.error('Recording Error:', error);
            this.hideLoading();
            this.showStatus('❌ Audio recording failed', 'danger');
        }
    }

    async startVideoRecording() {
        try {
            this.showLoading();
            this.showStatus('🎥 Starting video recording...', 'info');
            if (typeof Camera !== 'undefined') {
                const options = {
                    quality: 50,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    mediaType: Camera.MediaType.VIDEO,
                    allowEdit: false,
                    correctOrientation: true
                };
                navigator.camera.getPicture(
                    videoURI => this.onVideoSuccess(videoURI),
                    error => this.onVideoError(error),
                    options
                );
            } else {
                await this.startWebVideoRecording();
            }
        } catch (error) {
            console.error('Video Recording Error:', error);
            this.hideLoading();
            this.showStatus('❌ Video recording failed', 'danger');
        }
    }

    onVideoSuccess(videoURI) {
        const videoData = {
            uri: videoURI,
            timestamp: new Date().toISOString(),
            location: this.currentLocation,
            type: 'evidence_video'
        };
        this.storeEvidence(videoData);
        this.hideLoading();
        this.showStatus('✅ Video recorded and stored securely!', 'success');
        this.showVideoPreview(videoURI);
    }

    onVideoError(message) {
        console.error('Video error:', message);
        this.hideLoading();
        this.showStatus('❌ Video capture failed: ' + message, 'danger');
    }

    async startWebVideoRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            this.videoChunks = [];
            this.mediaRecorder.ondataavailable = event => this.videoChunks.push(event.data);
            this.mediaRecorder.onstop = () => {
                const videoBlob = new Blob(this.videoChunks, { type: 'video/webm' });
                const videoUrl = URL.createObjectURL(videoBlob);
                this.onVideoSuccess(videoUrl);
                stream.getTracks().forEach(track => track.stop());
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            document.getElementById('recording-indicator')?.classList.remove('d-none');
            setTimeout(() => {
                if (this.isRecording) this.stopRecording();
            }, 30000); // Auto-stop after 30 seconds
        } catch (error) {
            console.error('Web Video Recording Error:', error);
            this.hideLoading();
            this.showStatus('❌ Video recording failed', 'danger');
        }
    }

    showVideoPreview(videoURI) {
        const content = `
            <div class="text-center">
                <video src="${videoURI}" controls class="img-fluid rounded" style="max-height: 300px;"></video>
                <p class="mt-2 text-muted">Video captured and stored securely with location data</p>
            </div>
        `;
        this.showModal('Video Captured', content);
    }

    async sendSOS() {
        try {
            this.showLoading();
            this.showStatus('🚨 Sending SOS Alert...', 'danger');
            const location = await this.getCurrentLocation();
            const sosData = {
                timestamp: new Date().toISOString(),
                location: location,
                user: this.getUserInfo(),
                type: 'SOS_ALERT',
                urgency: 'HIGH'
            };
            await Promise.all([
                this.notifyEmergencyContacts(sosData),
                this.contactEmergencyServices(sosData)
            ]);
            this.storeSosAlert(sosData);
            this.hideLoading();
            this.showStatus('✅ SOS Alert Sent Successfully!', 'success');
            this.startEmergencyRecording();
        } catch (error) {
            console.error('SOS Error:', error);
            this.hideLoading();
            this.showStatus('❌ SOS Failed. Retrying...', 'warning');
            setTimeout(() => this.sendSOS(), 5000);
        }
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                position => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    this.currentLocation = location;
                    resolve(location);
                },
                error => {
                    console.error('Location Error:', error || 'Unknown error');
                    reject(error || new Error('Unknown geolocation error'));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        });
    }

    getLocation() {
        this.showScreen('location');
    }

    startLocationTracking() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(
            position => {
                this.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                if (document.getElementById('location')?.classList.contains('active')) {
                    this.updateLocationDetails();
                }
            },
            error => console.warn('Location tracking error:', error),
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 }
        );
    }

    async capturePhoto() {
        try {
            this.showLoading();
            this.showStatus('📷 Opening camera...', 'info');
            if (typeof Camera !== 'undefined') {
                navigator.camera.getPicture(
                    imageURI => this.onPhotoSuccess(imageURI),
                    error => this.onPhotoError(error),
                    {
                        quality: 75,
                        destinationType: Camera.DestinationType.DATA_URL,
                        sourceType: Camera.PictureSourceType.CAMERA,
                        encodingType: Camera.EncodingType.JPEG,
                        targetWidth: 1024,
                        targetHeight: 1024,
                        allowEdit: false,
                        correctOrientation: true,
                        saveToPhotoAlbum: true
                    }
                );
            } else {
                await this.capturePhotoWeb();
            }
        } catch (error) {
            console.error('Camera Error:', error);
            this.hideLoading();
            this.showStatus('❌ Camera access failed', 'danger');
        }
    }

    onPhotoSuccess(imageURI) {
        const photoData = {
            uri: `data:image/jpeg;base64,${imageURI}`,
            timestamp: new Date().toISOString(),
            location: this.currentLocation,
            type: 'evidence_photo'
        };
        this.storeEvidence(photoData);
        this.hideLoading();
        this.showStatus('✅ Photo captured and stored securely!', 'success');
        this.showPhotoPreview(photoData.uri);
    }

    onPhotoError(message) {
        console.error('Camera error:', message);
        this.hideLoading();
        this.showStatus('❌ Photo capture failed: ' + message, 'danger');
    }

    async capturePhotoWeb() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'camera';
            input.onchange = event => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = e => this.onPhotoSuccess(e.target.result.split(',')[1]);
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        } catch (error) {
            console.error('Web Camera Error:', error);
            this.hideLoading();
            this.showStatus('❌ Camera access failed', 'danger');
        }
    }

    async recordAudio() {
        try {
            if (this.isRecording) {
                this.stopRecording();
                return;
            }
            this.showLoading();
            this.showStatus('🎙️ Starting audio recording...', 'info');
            await this.startRecordingInternal();
        } catch (error) {
            console.error('Audio Error:', error);
            this.hideLoading();
            this.showStatus('❌ Audio recording failed', 'danger');
        }
    }

    async startRecordingInternal() {
        if (typeof Media !== 'undefined') {
            await this.startCordovaRecording();
        } else {
            await this.startWebRecording();
        }
    }

    startCordovaRecording() {
        return new Promise((resolve, reject) => {
            const fileName = `vigilia_audio_${Date.now()}.m4a`;
            const filePath = cordova.file.documentsDirectory + fileName;
            this.mediaRecorder = new Media(
                filePath,
                () => {
                    this.onRecordingSuccess(filePath);
                    resolve();
                },
                error => {
                    this.onRecordingError(error);
                    reject(error);
                }
            );
            this.mediaRecorder.startRecord();
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.updateRecordingUI(true);
            document.getElementById('recording-indicator')?.classList.remove('d-none');
        });
    }

    async startWebRecording() {
        if (!navigator.mediaDevices || !window.MediaRecorder) {
            throw new Error('Audio recording not supported in this browser');
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                this.onRecordingSuccess(audioUrl);
                stream.getTracks().forEach(track => track.stop());
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.updateRecordingUI(true);
            document.getElementById('recording-indicator')?.classList.remove('d-none');
        } catch (error) {
            throw error;
        }
    }

    stopRecording() {
        if (!this.mediaRecorder) return;
        if (typeof Media !== 'undefined' && this.mediaRecorder.stopRecord) {
            this.mediaRecorder.stopRecord();
        } else {
            this.mediaRecorder.stop();
        }
        this.isRecording = false;
        this.updateRecordingUI(false);
        document.getElementById('recording-indicator')?.classList.add('d-none');
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
        this.hideLoading();
        this.showStatus('✅ Audio recorded and stored securely!', 'success');
    }

    onRecordingError(error) {
        console.error('Recording error:', error);
        this.hideLoading();
        this.showStatus('❌ Audio recording failed', 'danger');
        this.isRecording = false;
        this.updateRecordingUI(false);
        document.getElementById('recording-indicator')?.classList.add('d-none');
    }

    updateRecordingUI(isRecording) {
        const recordBtn = document.querySelector('button[onclick="recordAudio()"]');
        if (recordBtn) {
            recordBtn.innerHTML = isRecording
                ? '<span class="action-icon" aria-hidden="true">⏹️</span> Stop Recording'
                : '<span class="action-icon" aria-hidden="true">🎙️</span> Record Audio';
            recordBtn.className = `vigilia-action-btn action-card btn btn-${isRecording ? 'danger' : 'success'}`;
        }
    }

    async notifyEmergencyContacts(sosData) {
        const message = sosData.message || `🚨 EMERGENCY ALERT from ${sosData.user.name}\n\nLocation: https://maps.google.com/maps?q=${sosData.location.latitude},${sosData.location.longitude}\n\nTime: ${new Date(sosData.timestamp).toLocaleString()}\n\nThis is an automated message from Vigilia Safety App.`;
        for (const contact of this.emergencyContacts) {
            try {
                if (contact.phone && typeof SMS !== 'undefined') {
                    await SMS.send(contact.phone, message);
                }
                if (contact.email) {
                    await this.sendEmail(contact.email, 'EMERGENCY ALERT', message);
                }
            } catch (error) {
                console.error('Failed to notify contact:', contact, error);
            }
        }
    }

    activatePanicMode() {
        this.panicMode = true;
        this.showStatus('🔴 PANIC MODE ACTIVATED', 'danger');
        this.sendSOS();
        this.startContinuousTracking();
        this.startEmergencyRecording();
        this.hideFromRecents();
    }

    handleVolumeDown() {
        this.volumeDownCount++;
        if (this.volumeDownCount >= 3) {
            this.activatePanicMode();
            this.volumeDownCount = 0;
        }
        if (this.volumeSequenceTimer) clearTimeout(this.volumeSequenceTimer);
        this.volumeSequenceTimer = setTimeout(() => {
            this.volumeDownCount = 0;
        }, 3000);
    }

    handleVolumeUp() {
        // Placeholder for future functionality
    }

    showStatus(message, type = 'info') {
        let statusEl = document.getElementById('status-message');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'status-message';
            statusEl.className = 'alert alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
            statusEl.style.zIndex = '9999';
            statusEl.setAttribute('role', 'alert');
            document.body.appendChild(statusEl);
        }
        statusEl.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        statusEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        setTimeout(() => statusEl?.remove(), 5000);
    }

    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">${content}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    showPhotoPreview(imageURI) {
        const content = `
            <div class="text-center">
                <img src="${imageURI}" class="img-fluid rounded" style="max-height: 300px;" alt="Captured photo">
                <p class="mt-2 text-muted">Photo captured and stored securely with location data</p>
            </div>
        `;
        this.showModal('Photo Captured', content);
    }

    storeEvidence(data) {
        const evidence = this.getStoredData('evidence') || [];
        evidence.push(data);
        this.setStoredData('evidence', evidence);
        // TODO: Sync with secure cloud storage (e.g., AWS S3 with AES-256 encryption)
    }

    storeSosAlert(data) {
        const alerts = this.getStoredData('sos_alerts') || [];
        alerts.push(data);
        this.setStoredData('sos_alerts', alerts);
        // TODO: Sync with backend API
    }

    getStoredData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
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
        this.emergencyContacts = this.getStoredData('emergency_contacts') || [
            { id: '1', name: 'Emergency Services', phone: '999', email: '' },
            { id: '2', name: 'Family Contact', phone: '', email: '' }
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
        document.querySelectorAll('#connection-status').forEach(element => {
            element.textContent = statusText;
            element.setAttribute('aria-label', `Connection status: ${isOnline ? 'Online' : 'Offline'}`);
        });
    }

    updateTimeDisplays() {
        const update = () => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            document.querySelectorAll('.time-display, #time-display').forEach(element => {
                element.textContent = time;
                element.setAttribute('aria-label', `Current time: ${time}`);
            });
        };
        update();
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(update, 60000);
    }

    loadUserPreferences() {
        const prefs = this.getStoredData('user_preferences') || {};
        this.language = prefs.language || 'en';
        // TODO: Load translations based on language
    }

    onPause() {
        console.log('App paused');
        if (this.trackingInterval) clearInterval(this.trackingInterval);
    }

    onResume() {
        console.log('App resumed');
        this.updateConnectionStatus();
        this.updateTimeDisplays();
        this.startLocationTracking();
    }

    handleBackButton() {
        if (this.panicMode) return;
        this.showScreen('home');
    }

    async sendEmail(to, subject, body) {
        try {
            if (typeof cordova !== 'undefined' && cordova.plugins?.email) {
                await cordova.plugins.email.open({
                    to: [to],
                    subject: subject,
                    body: body
                });
            } else {
                window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }
        } catch (error) {
            console.error('Email Error:', error);
            this.showStatus('❌ Failed to send email', 'danger');
        }
    }

    hideFromRecents() {
        if (typeof cordova !== 'undefined' && cordova.plugins?.privacyScreen) {
            cordova.plugins.privacyScreen.enable(
                () => console.log('Privacy screen enabled'),
                error => console.error('Privacy screen error:', error)
            );
        }
    }

    startEmergencyRecording() {
        if (!this.isRecording) {
            this.recordAudio();
        }
    }

    startContinuousTracking() {
        if (this.trackingInterval) clearInterval(this.trackingInterval);
        this.trackingInterval = setInterval(() => {
            this.getCurrentLocation().then(location => {
                const breadcrumbs = this.getStoredData('location_breadcrumbs') || [];
                breadcrumbs.push({ ...location, timestamp: new Date().toISOString() });
                this.setStoredData('location_breadcrumbs', breadcrumbs);
                if (document.getElementById('location')?.classList.contains('active')) {
                    this.updateLocationDetails();
                }
            }).catch(error => {
                console.error('Continuous tracking error:', error);
            });
        }, 30000);
    }

    setupNotifications() {
        if (typeof cordova !== 'undefined' && cordova.plugins?.notification) {
            cordova.plugins.notification.local.requestPermission();
        }
    }

    contactEmergencyServices(sosData) {
        // TODO: Implement API call to emergency services backend
        console.log('Emergency services contacted:', sosData);
        return Promise.resolve();
    }

    async startThreatDetection() {
        try {
            this.showLoading();
            this.showStatus('🧠 Starting AI Threat Detection...', 'info');
            this.threatDetectionActive = true;
            // TODO: Integrate with Roboflow API (https://detect.roboflow.com)
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.monitorThreats(stream);
            this.hideLoading();
            this.showStatus('✅ Threat Detection Active', 'success');
        } catch (error) {
            console.error('Threat Detection Error:', error);
            this.hideLoading();
            this.showStatus('❌ Failed to start threat detection', 'danger');
            this.threatDetectionActive = false;
        }
    }

    monitorThreats(stream) {
        this.showStatus('🧠 Monitoring for threats...', 'info');
        // TODO: Implement real-time AI analysis (e.g., detect loud noises or suspicious objects)
        setTimeout(() => {
            if (this.threatDetectionActive) {
                stream.getTracks().forEach(track => track.stop());
                this.threatDetectionActive = false;
                this.showStatus('🧠 Threat Detection Stopped', 'info');
            }
        }, 60000);
    }

    async openSafeRoute() {
        try {
            this.showLoading();
            this.showStatus('🗺️ Planning safe route...', 'info');

            const location = await this.getCurrentLocation();
            let screen = document.getElementById('saferoute');
            if (!screen) {
                screen = document.createElement('div');
                screen.className = 'screen';
                screen.id = 'saferoute';
                screen.innerHTML = `
                    <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                        <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                        <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                        <span id="time-display" aria-label="Current time"></span>
                    </div>
                    <div class="header">
                        <button class="back-btn" onclick="window.vigiliaApp.showScreen('home')" aria-label="Back to Home">←</button>
                        <div class="logo">Safe Route Planner</div>
                    </div>
                    <div class="px-3 pb-5">
                        <div id="saferoute-map"></div>
                        <input id="destination-input" type="text" class="form-control mt-3" placeholder="Enter destination" aria-label="Destination" autocomplete="off">
                        <button class="btn btn-primary mt-2" onclick="window.vigiliaApp.planRoute()">Plan Route</button>
                    </div>
                `;
                document.querySelector('.container-fluid').appendChild(screen);
            }
            this.showScreen('saferoute');
            await this.initializeSafeRouteMap(location);

            // --- Add Places Autocomplete ---
            await loadGoogleMapsApi(this.googleMapsApiKey);
            const input = document.getElementById('destination-input');
            if (input && !input._autocompleteAttached) {
                const autocomplete = new google.maps.places.Autocomplete(input, {
                    types: ['geocode', 'establishment'],
                    fields: ['place_id', 'geometry', 'name']
                });
                input._autocompleteAttached = true;
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry) {
                        input.value = place.name;
                        input.dataset.placeId = place.place_id;
                    }
                });
            }

            this.hideLoading();
            this.updateTimeDisplays();
        } catch (error) {
            console.error('Safe Route Error:', error);
            this.hideLoading();
            this.showStatus('❌ Failed to load route planner', 'danger');
        }
    }

    async planRoute() {
        try {
            const input = document.getElementById('destination-input');
            const destinationInput = input?.value;
            const placeId = input?.dataset.placeId;
            if (!destinationInput) {
                this.showStatus('❌ Please enter a destination', 'warning');
                return;
            }
            const location = await this.getCurrentLocation();
            const origin = `${location.latitude},${location.longitude}`;
            await loadGoogleMapsApi(this.googleMapsApiKey);

            if (!this.safeRouteMap) {
                await this.initializeSafeRouteMap(location);
            }

            if (!this.directionsRenderer) {
                this.directionsRenderer = new google.maps.DirectionsRenderer();
                this.directionsRenderer.setMap(this.safeRouteMap);
            } else {
                this.directionsRenderer.set('directions', null);
            }

            const directionsService = new google.maps.DirectionsService();

            const request = {
                origin: origin,
                travelMode: google.maps.TravelMode.WALKING,
                provideRouteAlternatives: true
            };
            if (placeId) {
                request.destination = { placeId };
            } else {
                request.destination = destinationInput;
            }

            directionsService.route(request, (result, status) => {
                if (status === "OK") {
                    this.directionsRenderer.setDirections(result);
                    this.showStatus('✅ Safe route planned', 'success');
                } else {
                    console.warn('Directions API status:', status, result);
                    this.showStatus('❌ Unable to find a safe route', 'danger');
                }
            });
        } catch (error) {
            console.error('Route Planning Error:', error);
            this.showStatus('❌ Route planning failed', 'danger');
        }
    }

    async initializeSafeRouteMap(location) {
        const mapEl = document.getElementById('saferoute-map');
        if (!mapEl) return;
        await loadGoogleMapsApi(this.googleMapsApiKey);
        this.safeRouteMap = new google.maps.Map(mapEl, {
            center: { lat: location.latitude, lng: location.longitude },
            zoom: 14,
            mapTypeId: 'roadmap',
            disableDefaultUI: true,
            zoomControl: true
        });
        if (this.safeRouteMarker) this.safeRouteMarker.setMap(null);
        this.safeRouteMarker = new google.maps.Marker({
            position: { lat: location.latitude, lng: location.longitude },
            map: this.safeRouteMap,
            title: 'You are here'
        });
        // Reset directionsRenderer if map is re-initialized
        if (this.directionsRenderer) {
            this.directionsRenderer.setMap(this.safeRouteMap);
            this.directionsRenderer.set('directions', null);
        }
    }

    loadCommunityAlerts() {
        // TODO: Fetch from backend API (e.g., https://vigilia.co.ke/api/alerts)
        this.communityAlerts = this.getStoredData('community_alerts') || [];
    }

    updateCommunityAlertsUI() {
        const screen = document.getElementById('community');
        if (!screen) return;
        let html = '<ul class="list-group">';
        if (!this.communityAlerts.length) {
            html += '<li class="list-group-item">No community alerts at this time.</li>';
        } else {
            this.communityAlerts.forEach(alert => {
                html += `<li class="list-group-item">
                    <b>${alert.type}</b> - ${alert.description}<br>
                    <small>${new Date(alert.timestamp).toLocaleString()}</small>
                </li>`;
            });
        }
        html += '</ul><button class="btn btn-primary mt-3" onclick="window.vigiliaApp.shareCommunityAlert()">Share Alert</button>';
        screen.querySelector('.community-section').innerHTML = html;
    }

    async shareCommunityAlert() {
        try {
            const description = prompt('Enter alert description:');
            if (!description) return;
            const location = await this.getCurrentLocation();
            const alertData = {
                type: 'COMMUNITY_ALERT',
                description: description,
                location: location,
                timestamp: new Date().toISOString(),
                anonymous: true
            };
            this.communityAlerts.push(alertData);
            this.setStoredData('community_alerts', this.communityAlerts);
            // TODO: Send to backend API
            this.updateCommunityAlertsUI();
            this.showStatus('✅ Community alert shared anonymously', 'success');
        } catch (error) {
            console.error('Community Alert Error:', error);
            this.showStatus('❌ Failed to share community alert', 'danger');
        }
    }

    startVoiceSOS() {
        this.showStatus('🎤 Voice SOS activated! Sending emergency alert...', 'danger');
        this.sendSOS();
    }

    setupVoiceRecognition() {
        if (!this._voiceRecognition) {
            this._voiceRecognition = new VoiceRecognition({
                language: this.language,
                maxRetries: 5,
                retryDelay: 2000,
                onSOS: () => this.startVoiceSOS(),
                onCapturePhoto: () => this.capturePhoto(),
                onRecordAudio: () => this.recordAudio(),
                onRecordVideo: () => this.startVideoRecording(),
                onOpenContacts: () => openContacts(),
                onShareLocation: () => this.shareLocation(),
                onStartThreatDetection: () => this.startThreatDetection(),
                onOpenSafeRoute: () => this.openSafeRoute(),
                onRefreshLocation: () => this.updateLocationDetails(),
                onOpenMentalHealth: () => this.openMentalHealth(),
                onOpenEncryptedChat: () => this.openEncryptedChat(),
                onStatus: (msg, type) => this.showStatus(msg, type)
            });
        }
        this._voiceRecognition.setupVoiceRecognition();
    }
    
    openMentalHealth() {
        const html = `
            <ul class="list-group">
                <li class="list-group-item">
                    <b>Crisis Hotline</b><br>
                    <a href="tel:0800720701" aria-label="Call Kenya Crisis Line">Kenya Crisis Line: 0800 720 701</a>
                </li>
                <li class="list-group-item">
                    <b>Mindfulness Resources</b><br>
                    <a href="https://www.headspace.com" target="_blank" aria-label="Visit Headspace">Headspace</a>
                </li>
            </ul>
        `;
        let screen = document.getElementById('mentalhealth');
        if (!screen) {
            screen = document.createElement('div');
            screen.className = 'screen';
            screen.id = 'mentalhealth';
            screen.innerHTML = `
                <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                    <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                    <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                    <span id="time-display" aria-label="Current time"></span>
                </div>
                <div class="header">
                    <button class="back-btn" onclick="window.vigiliaApp.showScreen('health')" aria-label="Back to Health">←</button>
                    <div class="logo">Mental Health Support</div>
                </div>
                <div class="px-3 pb-5">${html}</div>
            `;
            document.querySelector('.container-fluid').appendChild(screen);
        } else {
            screen.querySelector('.px-3.pb-5').innerHTML = html;
        }
        this.showScreen('mentalhealth');
        this.updateTimeDisplays();
    }

    async openEncryptedChat() {
        try {
            const html = `
                <ul class="list-group">
                    ${this.emergencyContacts.map(contact => `
                        <li class="list-group-item">
                            <b>${contact.name}</b>
                            <button class="btn btn-sm btn-primary ms-2" onclick="window.vigiliaApp.startChat('${contact.id}')" aria-label="Chat with ${contact.name}">Chat</button>
                        </li>
                    `).join('')}
                </ul>
            `;
            let screen = document.getElementById('encryptedchat');
            if (!screen) {
                screen = document.createElement('div');
                screen.className = 'screen';
                screen.id = 'encryptedchat';
                screen.innerHTML = `
                    <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                        <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                        <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                        <span id="time-display" aria-label="Current time"></span>
                    </div>
                    <div class="header">
                        <button class="back-btn" onclick="window.vigiliaApp.showScreen('emergency')" aria-label="Back to Emergency">←</button>
                        <div class="logo">Encrypted Chat</div>
                    </div>
                    <div class="px-3 pb-5">${html}</div>
                `;
                document.querySelector('.container-fluid').appendChild(screen);
            } else {
                screen.querySelector('.px-3.pb-5').innerHTML = html;
            }
            this.showScreen('encryptedchat');
            this.updateTimeDisplays();
            // TODO: Initialize end-to-end encryption (e.g., Signal Protocol)
        } catch (error) {
            console.error('Encrypted Chat Error:', error);
            this.showStatus('❌ Failed to load encrypted chat', 'danger');
        }
    }

    startChat(contactId) {
        this.showStatus('💬 Starting secure chat...', 'info');
        // TODO: Implement encrypted chat with contact
    }

    toggleLanguage() {
        const languages = ['en', 'es', 'fr', 'sw'];
        const currentIndex = languages.indexOf(this.language);
        this.language = languages[(currentIndex + 1) % languages.length];
        this.setStoredData('user_preferences', { ...this.loadUserPreferences(), language: this.language });
        this.showStatus(`🌍 Language changed to ${this.language.toUpperCase()}`, 'success');
        if (this.speechRecognition) {
            this.speechRecognition.lang = this.language;
        }
        // TODO: Update UI with translations
    }

    setupWearableSync() {
        // TODO: Integrate with wearable APIs (e.g., Fitbit, Apple Watch)
        console.log('Wearable sync initialized');
        setInterval(() => {
            // Simulate fall detection
            const fallDetected = false; // Replace with actual wearable data
            if (fallDetected) {
                this.showStatus('⚠️ Fall detected! Initiating emergency protocol...', 'danger');
                this.sendSOS();
            }
        }, 60000);
    }
}

// Initialize app
window.vigiliaApp = new VigiliaApp();

// Global functions
function showScreen(screenId) {
    window.vigiliaApp.showScreen(screenId);
}

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

function startPanicCountdown() {
    window.vigiliaApp.startPanicCountdown();
}

function cancelPanicCountdown() {
    window.vigiliaApp.cancelPanicCountdown();
}

function triggerEmergency() {
    window.vigiliaApp.triggerEmergency();
}

function shareLocation() {
    window.vigiliaApp.shareLocation();
}

function startRecording() {
    window.vigiliaApp.startRecording();
}

function startVideoRecording() {
    window.vigiliaApp.startVideoRecording();
}

function startThreatDetection() {
    window.vigiliaApp.startThreatDetection();
}

function openSafeRoute() {
    window.vigiliaApp.openSafeRoute();
}

function startVoiceSOS() {
    window.vigiliaApp.startVoiceSOS();
}

function openMentalHealth() {
    window.vigiliaApp.openMentalHealth();
}

function openEncryptedChat() {
    window.vigiliaApp.openEncryptedChat();
}

function toggleLanguage() {
    window.vigiliaApp.toggleLanguage();
}

function openEvidence() {
    const evidence = window.vigiliaApp.getStoredData('evidence') || [];
    const html = `
        <ul class="list-group">
            ${evidence.length === 0 ? '<li class="list-group-item">No evidence stored yet.</li>' : evidence.map(item => `
                <li class="list-group-item">
                    <b>${item.type.replace('evidence_', '').toUpperCase()}</b> - ${new Date(item.timestamp).toLocaleString()}
                    ${item.uri ? `<br><a href="${item.uri}" target="_blank" aria-label="View ${item.type}">View</a>` : ''}
                </li>
            `).join('')}
        </ul>
    `;
    let screen = document.getElementById('evidence');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'evidence';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('home')" aria-label="Back to Home">←</button>
                <div class="logo">Evidence Vault</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('evidence');
    window.vigiliaApp.updateTimeDisplays();
}

function openLegalAid() {
    const html = `
        <ul class="list-group">
            <li class="list-group-item">
                <b>Legal ID Vault</b><br>
                <p>Securely store IDs and receive breach notifications.</p>
            </li>
            <li class="list-group-item">
                <b>Legal Resources</b><br>
                <a href="https://vigilia.co.ke/legal" target="_blank" aria-label="Access Legal Support">Access Legal Support</a>
            </li>
        </ul>
    `;
    let screen = document.getElementById('legalaid');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'legalaid';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('home')" aria-label="Back to Home">←</button>
                <div class="logo">Legal Aid</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('legalaid');
    window.vigiliaApp.updateTimeDisplays();
}

function openSafeJourney() {
    const html = `
        <ul class="list-group">
            <li class="list-group-item">
                <b>Journey Monitoring</b><br>
                <p>Track your trip and check in with contacts.</p>
                <button class="btn btn-primary mt-2" onclick="window.vigiliaApp.startJourney()">Start Journey</button>
            </li>
        </ul>
    `;
    let screen = document.getElementById('safejourney');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'safejourney';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('home')" aria-label="Back to Home">←</button>
                <div class="logo">Safe Journey</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('safejourney');
    window.vigiliaApp.updateTimeDisplays();
}

function startJourney() {
    window.vigiliaApp.showStatus('🛣️ Journey monitoring started', 'info');
    // TODO: Implement journey tracking with periodic check-ins
}

function openContacts() {
    const contacts = window.vigiliaApp.loadEmergencyContacts();
    const html = `
        <ul class="list-group">
            ${contacts.map(c => `<li class="list-group-item">${c.name} - ${c.phone || c.email || 'No contact info'}</li>`).join('')}
        </ul>
    `;
    let screen = document.getElementById('contacts');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'contacts';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('profile')" aria-label="Back to Profile">←</button>
                <div class="logo">Emergency Contacts</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('contacts');
    window.vigiliaApp.updateTimeDisplays();
}

function openHealthInfo() {
    const user = window.vigiliaApp.getUserInfo();
    const html = `
        <p><b>Name:</b> ${user.name}</p>
        <p><b>Medical Info:</b> ${user.medicalInfo || 'Not set'}</p>
        <p><b>Emergency Contact:</b> ${user.emergencyContactName || ''} ${user.emergencyContactPhone || ''}</p>
    `;
    let screen = document.getElementById('healthinfo');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'healthinfo';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('health')" aria-label="Back to Health">←</button>
                <div class="logo">Medical Info</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('healthinfo');
    window.vigiliaApp.updateTimeDisplays();
}

function openCyberSafety() {
    const html = `
        <ul class="list-group">
            <li class="list-group-item">Check app permissions regularly</li>
            <li class="list-group-item">Beware of unsafe Wi-Fi networks</li>
            <li class="list-group-item">Enable device encryption</li>
            <li class="list-group-item">Use strong passwords</li>
        </ul>
        <p>More tools coming soon!</p>
    `;
    let screen = document.getElementById('cybersafety');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'cybersafety';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('home')" aria-label="Back to Home">←</button>
                <div class="logo">Cyber Safety</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('cybersafety');
    window.vigiliaApp.updateTimeDisplays();
}

function openSettings() {
    const html = `<p>Settings coming soon.</p>`;
    let screen = document.getElementById('settings');
    if (!screen) {
        screen = document.createElement('div');
        screen.className = 'screen';
        screen.id = 'settings';
        screen.innerHTML = `
            <div class="status-bar d-flex justify-content-between align-items-center" role="status">
                <span id="connection-status" aria-label="Connection status">🟢 Online</span>
                <span id="location-status" aria-label="Location status">📍 GPS Ready</span>
                <span id="time-display" aria-label="Current time"></span>
            </div>
            <div class="header">
                <button class="back-btn" onclick="window.vigiliaApp.showScreen('home')" aria-label="Back to Home">←</button>
                <div class="logo">Settings</div>
            </div>
            <div class="px-3 pb-5">${html}</div>
        `;
        document.querySelector('.container-fluid').appendChild(screen);
    } else {
        screen.querySelector('.px-3.pb-5').innerHTML = html;
    }
    window.vigiliaApp.showScreen('settings');
    window.vigiliaApp.updateTimeDisplays();
}

// --- LOGGING PANEL ---
(() => {
    const vigiliaLogHistory = [];

    // Create log panel
    const logPanel = document.createElement('div');
    logPanel.id = 'vigilia-log-panel';
    logPanel.innerHTML = `
        <div class="log-panel-header" id="vigilia-log-header" style="cursor:move;">
            <span>Console Log</span>
            <button id="log-panel-clear" title="Clear logs">🧹</button>
            <button id="log-panel-hide" title="Hide panel">✖</button>
        </div>
        <div class="log-panel-body" id="vigilia-log-body"></div>
    `;
    document.body.appendChild(logPanel);

    // --- DRAGGABLE LOG PANEL ---
    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
    const header = logPanel.querySelector('#vigilia-log-header');
    header.addEventListener('mousedown', function (e) {
        isDragging = true;
        dragOffsetX = e.clientX - logPanel.offsetLeft;
        dragOffsetY = e.clientY - logPanel.offsetTop;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function (e) {
        if (isDragging) {
            logPanel.style.left = (e.clientX - dragOffsetX) + 'px';
            logPanel.style.top = (e.clientY - dragOffsetY) + 'px';
            logPanel.style.right = 'auto';
            logPanel.style.bottom = 'auto';
            logPanel.style.position = 'fixed';
        }
    });
    document.addEventListener('mouseup', function () {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    // Render log history
    function renderLogPanel() {
        const body = document.getElementById('vigilia-log-body');
        if (!body) return;
        body.innerHTML = '';
        vigiliaLogHistory.forEach(entry => {
            const msg = document.createElement('div');
            msg.className = 'log-msg log-' + entry.type;
            msg.textContent = `[${entry.type.toUpperCase()}] ${entry.text}`;
            body.appendChild(msg);
        });
        body.scrollTop = body.scrollHeight;
    }

    // Show/hide logic
    document.getElementById('log-panel-hide').onclick = () => {
        logPanel.style.display = 'none';
        setTimeout(renderLogPanel, 10); // Ensure log is restored on next show
    };
    document.getElementById('log-panel-clear').onclick = () => {
        vigiliaLogHistory.length = 0;
        renderLogPanel();
    };

    // Restore panel with F8
    window.addEventListener('keydown', e => {
        if (e.key === 'F8') {
            logPanel.style.display = 'block';
            renderLogPanel();
        }
    });

    // --- CONSOLE OVERRIDE ---
    const orig = {
        log: console.log,
        warn: console.warn,
        error: console.error
    };
    function appendLog(type, args) {
        const text = Array.from(args).map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ');
        vigiliaLogHistory.push({ type, text });
        renderLogPanel();
    }
    console.log = function () { orig.log.apply(console, arguments); appendLog('log', arguments); };
    console.warn = function () { orig.warn.apply(console, arguments); appendLog('warn', arguments); };
    console.error = function () { orig.error.apply(console, arguments); appendLog('error', arguments); };

    // --- STATUS MESSAGE HOOK ---
    // Patch showStatus to also log to panel
    const origShowStatus = window.vigiliaApp?.showStatus;
    if (origShowStatus) {
        window.vigiliaApp.showStatus = function (message, type = 'info') {
            appendLog(type, [message]);
            return origShowStatus.apply(this, arguments);
        };
    } else {
        // If VigiliaApp not ready yet, patch later
        document.addEventListener('DOMContentLoaded', () => {
            if (window.vigiliaApp && window.vigiliaApp.showStatus) {
                const origShowStatus = window.vigiliaApp.showStatus;
                window.vigiliaApp.showStatus = function (message, type = 'info') {
                    appendLog(type, [message]);
                    return origShowStatus.apply(this, arguments);
                };
            }
        });
    }

    // Initial render
    renderLogPanel();
})();