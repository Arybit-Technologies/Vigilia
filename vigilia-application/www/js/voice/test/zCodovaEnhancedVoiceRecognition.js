/**
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

/**
 * Enhanced VoiceRecognition: Advanced voice command system for the Vigilia safety app.
 * Supports Web Speech API and Cordova with whisper detection, adaptive sensitivity, continuous listening,
 * background mode, file rotation, and improved fuzzy matching.
 */
class VoiceRecognition {
    /**
     * Initializes the VoiceRecognition system with configurable options.
     * @param {Object} [options={}] - Configuration options.
     */
    constructor(options = {}) {
        // Configuration with defaults
        this.config = {
            language: options.language || window?.vigiliaApp?.language || 'en-US',
            continuous: options.continuous !== undefined ? options.continuous : true,
            interimResults: options.interimResults !== undefined ? options.interimResults : true,
            maxRetries: options.maxRetries || 5,
            retryDelay: options.retryDelay || 500,
            confidenceThreshold: options.confidenceThreshold || 0.7,
            sensitivity: options.sensitivity || 0.08,
            whisperSensitivity: options.whisperSensitivity || 0.03,
            silenceThreshold: options.silenceThreshold || 0.015,
            silenceTimeout: options.silenceTimeout || 1500,
            bufferSize: options.bufferSize || 4096,
            maxBufferSize: options.maxBufferSize || 500000,
            chunkDuration: options.chunkDuration || 500, // Adjusted for overlap
            audioChunkDuration: options.audioChunkDuration || 1000, // 1-second chunks
            fileRotationInterval: options.fileRotationInterval || 30000, // 30 seconds
            fuzzyThreshold: options.fuzzyThreshold || 0.6,
            debug: options.debug || false,
            autoRestart: options.autoRestart !== undefined ? options.autoRestart : true,
            adaptiveSensitivity: options.adaptiveSensitivity !== undefined ? options.adaptiveSensitivity : true,
            backgroundMode: options.backgroundMode !== undefined ? options.backgroundMode : true,
            logEndpoint: options.logEndpoint || null,
            triggers: new Map([
                ['vigilia help', { action: 'onSOS', priority: 1, fuzzy: ['vigil help', 'vigilante help', 'vigilio help'] }],
                ['vigilia sos', { action: 'onSOS', priority: 1, fuzzy: ['vigil sos', 'vigi', 'sos'] }],
                ['help me', { action: 'onSOS', priority: 1, fuzzy: ['help', 'emergency', 'danger', 'assist me', 'send help'] }],
                ['whisper help', { action: 'onSOS', priority: 1, fuzzy: ['quiet help', 'soft help'] }],
                ['take photo', { action: 'onCapturePhoto', priority: 2, fuzzy: ['snap picture', 'capture photo'] }],
                ['record audio', { action: 'onRecordAudio', priority: 2, fuzzy: ['start audio', 'audio record'] }],
                ['record video', { action: 'onRecordVideo', priority: 2, fuzzy: ['start video', 'video record'] }],
                ['open contacts', { action: 'onOpenContacts', priority: 2, fuzzy: ['call contacts', 'show contacts'] }],
                ['share location', { action: 'onShareLocation', priority: 2, fuzzy: ['send location', 'location share'] }],
                ['threat detection', { action: 'onStartThreatDetection', priority: 2, fuzzy: ['start threat', 'detect threat'] }],
                ['safe route', { action: 'onOpenSafeRoute', priority: 2, fuzzy: ['plan route', 'route planning'] }],
                ['refresh location', { action: 'onRefreshLocation', priority: 3, fuzzy: ['update location', 'location update'] }],
                ['mental health', { action: 'onOpenMentalHealth', priority: 3, fuzzy: ['help mental', 'mental support'] }],
                ['encrypted chat', { action: 'onOpenEncryptedChat', priority: 3, fuzzy: ['secure chat', 'private chat'] }],
                ['evidence vault', { action: 'onOpenEvidence', priority: 3, fuzzy: ['open evidence', 'evidence storage'] }],
                ['legal aid', { action: 'onOpenLegalAid', priority: 3, fuzzy: ['open legal', 'legal help'] }],
                ['safe journey', { action: 'onOpenSafeJourney', priority: 3, fuzzy: ['start journey', 'journey mode'] }],
                ['cyber safety', { action: 'onOpenCyberSafety', priority: 3, fuzzy: ['online safety', 'digital safety'] }],
                ['settings', { action: 'onOpenSettings', priority: 3, fuzzy: ['open settings', 'preferences'] }],
                ...(options.triggers || [])
            ]),
            callbacks: {
                onSOS: () => window?.vigiliaApp?.sendSOS?.() || this._log('Emergency SOS triggered', 'info'),
                onCapturePhoto: () => window?.vigiliaApp?.capturePhoto?.() || this._log('Capture photo triggered', 'info'),
                onRecordAudio: () => window?.vigiliaApp?.recordAudio?.() || this._log('Record audio triggered', 'info'),
                onRecordVideo: () => window?.vigiliaApp?.startVideoRecording?.() || this._log('Record video triggered', 'info'),
                onOpenContacts: () => window?.vigiliaApp?.showScreen?.('contacts') || this._log('Open contacts triggered', 'info'),
                onShareLocation: () => window?.vigiliaApp?.shareLocation?.() || this._log('Share location triggered', 'info'),
                onStartThreatDetection: () => window?.vigiliaApp?.startThreatDetection?.() || this._log('Threat detection triggered', 'info'),
                onOpenSafeRoute: () => window?.vigiliaApp?.openSafeRoute?.() || this._log('Open safe route triggered', 'info'),
                onRefreshLocation: () => window?.vigiliaApp?.updateLocationDetails?.() || this._log('Refresh location triggered', 'info'),
                onOpenMentalHealth: () => window?.vigiliaApp?.showScreen?.('health') || this._log('Open mental health triggered', 'info'),
                onOpenEncryptedChat: () => window?.vigiliaApp?.showScreen?.('chat') || this._log('Open encrypted chat triggered', 'info'),
                onOpenEvidence: () => window?.vigiliaApp?.showScreen?.('evidence') || this._log('Open evidence vault triggered', 'info'),
                onOpenLegalAid: () => window?.vigiliaApp?.showScreen?.('legal') || this._log('Open legal aid triggered', 'info'),
                onOpenSafeJourney: () => window?.vigiliaApp?.showScreen?.('journey') || this._log('Open safe journey triggered', 'info'),
                onOpenCyberSafety: () => window?.vigiliaApp?.showScreen?.('cyber') || this._log('Open cyber safety triggered', 'info'),
                onOpenSettings: () => window?.vigiliaApp?.showScreen?.('settings') || this._log('Open settings triggered', 'info'),
                onStatus: (msg, type) => window?.vigiliaApp?.showStatus?.(msg, type) || console.log(`[${type}] ${msg}`),
                onError: (msg) => window?.vigiliaApp?.showStatus?.(`Voice error: ${msg}`, 'danger') || console.error(`Error: ${msg}`),
                onWhisperDetected: (volume) => window?.vigiliaApp?.showStatus?.(`Whisper detected at ${volume.toFixed(4)}`, 'info') || console.log(`Whisper detected: ${volume.toFixed(4)}`),
                onBufferedSpeechProcessed: () => console.log('Buffered speech processed'),
                onListeningStart: () => console.log('Listening started'),
                onListeningStop: () => console.log('Listening stopped'),
                onSpeechStart: () => console.log('Speech detected'),
                onSpeechEnd: () => console.log('Speech ended'),
                onAudioStart: () => console.log('Audio input started'),
                onAudioEnd: () => console.log('Audio input ended'),
                onBackgroundModeEnabled: () => window?.vigiliaApp?.showStatus?.('Background mode enabled. Voice recognition continues in the background.', 'info') || console.log('Background mode enabled'),
                onBackgroundModeDisabled: () => window?.vigiliaApp?.showStatus?.('Background mode disabled. Voice recognition paused.', 'info') || console.log('Background mode disabled'),
                onMisrecognizedCommand: (transcript) => console.log(`Misrecognized command: "${transcript}"`),
                ...(options.callbacks || {})
            }
        };

        // State management
        this.state = {
            platform: this._detectPlatform(),
            recognition: null,
            isListening: false,
            isRecording: false,
            audioContext: null,
            microphone: null,
            processor: null,
            gainNode: null,
            analyserNode: null,
            audioRecorder: null,
            audioProcessingInterval: null,
            fileRotationInterval: null,
            currentAudioFile: null,
            voiceDetectionEnabled: false,
            lowVoiceMode: false,
            buffer: new Float32Array(0),
            silenceTimer: null,
            lastActivity: 0,
            avgVolume: 0,
            peakVolume: 0,
            noiseFloor: 0.01,
            logs: [],
            retryCount: 0,
            forceKeepAlive: false,
            isBackgroundModeActive: false,
            misrecognizedCommands: []
        };

        // Performance metrics
        this.metrics = {
            commandsProcessed: 0,
            successfulCommands: 0,
            averageConfidence: 0,
            processingTime: [],
            errorCount: 0,
            whisperDetections: 0
        };

        // Initialize Fuse.js for fuzzy matching
        this._initializeFuzzyMatching();

        // Bind methods
        this._bindMethods();

        // Initialize performance monitoring
        this._initializePerformanceMonitoring();

        // Initialize background mode
        this._initializeBackgroundMode();
    }

    /**
     * Detects the current platform for speech recognition.
     * @returns {string} Platform identifier ('Web', 'Cordova', or 'Unknown').
     * @private
     */
    _detectPlatform() {
        if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
            return 'Web';
        } else if (typeof cordova !== 'undefined' && (window.Media || cordova.plugins?.backgroundMode)) {
            return 'Cordova';
        }
        return 'Unknown';
    }

    /**
     * Initializes Fuse.js for fuzzy matching.
     * @private
     */
    _initializeFuzzyMatching() {
        const triggerList = Array.from(this.config.triggers.entries()).map(([command, details]) => ({
            command,
            action: details.action,
            priority: details.priority,
            fuzzy: details.fuzzy || []
        }));
        this.fuse = new Fuse(triggerList, {
            keys: ['command', 'fuzzy'],
            threshold: this.config.fuzzyThreshold,
            includeScore: true,
            useExtendedSearch: true
        });
    }

    /**
     * Binds instance methods to ensure correct 'this' context.
     * @private
     */
    _bindMethods() {
        const methods = [
            '_log', '_sendLogToBackend', 'setupVoiceRecognition', 'checkMicPermission', 'requestMicPermission',
            '_setupWebSpeechRecognition', '_setupCordovaSpeechRecognition', '_setupCordovaAudioRecording',
            '_startContinuousAudioProcessing', '_rotateAudioFile', '_processAudioChunk', '_readAudioChunk',
            '_setupAudioProcessing', '_processAudio', '_adjustSensitivity', '_calculateVolume', '_handleVoiceActivity',
            '_handleWhisperActivity', '_bufferAudio', '_handleSilence', '_processRecordedSpeech', '_float32ArrayToWavBlob',
            '_writeString', '_floatTo16BitPCM', '_handleNoSpeechDetected', '_logTranscript', '_processFinalResult',
            '_processInterimResult', '_processLowConfidenceTranscript', '_processTranscript', 'startListening',
            'stopListening', '_restartRecognition', '_handleResult', '_handleError', '_handleEnd',
            '_handleRecognitionStart', '_handleSpeechStart', '_handleSpeechEnd', '_handleAudioStart', '_handleAudioEnd',
            '_initializeBackgroundMode', '_handleBackgroundActivate', '_handleBackgroundDeactivate', 'toggleBackgroundMode',
            '_recoverFromError'
        ];
        methods.forEach(method => {
            this[method] = this[method].bind(this);
        });
    }

    /**
     * Initializes performance monitoring with periodic logging.
     * @private
     */
    _initializePerformanceMonitoring() {
        if (this.config.debug) {
            setInterval(() => {
                if (this.metrics.commandsProcessed || this.metrics.errorCount) {
                    const metrics = this.getMetrics();
                    this._log(
                        `Performance: ${metrics.successRate}% success, ${metrics.averageProcessingTime}, ${metrics.errorCount} errors, ${metrics.whisperDetections} whispers`,
                        'metric'
                    );
                }
            }, 60000);
        }
    }

    /**
     * Initializes background mode using cordova-plugin-background-mode with battery monitoring.
     * @private
     */
    _initializeBackgroundMode() {
        if (this.state.platform === 'Cordova' && this.config.backgroundMode && cordova.plugins?.backgroundMode) {
            cordova.plugins.backgroundMode.setDefaults({
                title: 'Vigilia Safety App',
                text: 'Voice recognition is running in the background to ensure your safety.',
                icon: 'icon',
                color: '#0000FF',
                resume: true,
                silent: false
            });
            cordova.plugins.backgroundMode.enable();
            cordova.plugins.backgroundMode.on('activate', this._handleBackgroundActivate);
            cordova.plugins.backgroundMode.on('deactivate', this._handleBackgroundDeactivate);
            // Monitor battery level
            navigator.getBattery?.().then(battery => {
                battery.addEventListener('levelchange', () => {
                    if (battery.level < 0.2 && this.state.isBackgroundModeActive) {
                        this._log('Low battery detected in background mode. Pausing non-critical processing.', 'warning');
                        this.config.callbacks.onStatus?.('Low battery detected. Voice recognition may pause to save power.', 'warning');
                    }
                });
            });
            this._log('Background mode initialized', 'success');
            this.config.callbacks.onBackgroundModeEnabled?.();
        }
    }

    /**
     * Handles background mode activation with optimized audio settings.
     * @private
     */
    _handleBackgroundActivate() {
        this.state.isBackgroundModeActive = true;
        this._log('Background mode activated. Optimizing for low power.', 'info', { batteryLevel: navigator.battery?.level || 'unknown' });
        if (cordova.plugins?.notification?.local) {
            cordova.plugins.notification.local.schedule({
                id: 1,
                title: 'Vigilia Safety App',
                text: 'Voice recognition is running in the background to ensure your safety.',
                foreground: true
            });
        }
        if (this.state.platform === 'Cordova' && this.state.audioRecorder) {
            clearInterval(this.state.audioProcessingInterval);
            this.state.audioProcessingInterval = setInterval(() => {
                if (this.state.isRecording && this.state.isListening) {
                    this._processAudioChunk(this.state.currentAudioFile);
                }
            }, 1500); // Reduced frequency in background
            this.state.audioRecorder.stopRecord();
            this.state.audioRecorder.startRecord({
                SampleRate: 8000,
                Channels: 1,
                AudioQuality: 'Low',
                AudioEncoding: 'wav',
                BufferSize: 2048
            });
        }
        if (!this.state.isListening) {
            this.startListening();
        }
        if (this.state.platform === 'Web' && this.state.audioContext) {
            this.state.audioContext.suspend().catch(e => this._log(`Error suspending AudioContext: ${e.message}`, 'error'));
        }
        this.config.callbacks.onBackgroundModeEnabled?.();
    }

    /**
     * Handles background mode deactivation with normal operation restoration.
     * @private
     */
    _handleBackgroundDeactivate() {
        this.state.isBackgroundModeActive = false;
        this._log('Background mode deactivated. Resuming normal operation.', 'info');
        if (this.state.platform === 'Cordova' && this.state.audioRecorder) {
            clearInterval(this.state.audioProcessingInterval);
            this.state.audioProcessingInterval = setInterval(() => {
                if (this.state.isRecording && this.state.isListening) {
                    this._processAudioChunk(this.state.currentAudioFile);
                }
            }, this.config.chunkDuration);
            this.state.audioRecorder.stopRecord();
            this.state.audioRecorder.startRecord({
                SampleRate: 16000,
                Channels: 1,
                AudioQuality: 'Low',
                AudioEncoding: 'wav',
                BufferSize: 4096
            });
        }
        if (this.state.platform === 'Web' && this.state.audioContext) {
            this.state.audioContext.resume().catch(e => this._log(`Error resuming AudioContext: ${e.message}`, 'error'));
        }
        if (cordova.plugins?.notification?.local) {
            cordova.plugins.notification.local.clear(1);
        }
        this.config.callbacks.onBackgroundModeDisabled?.();
    }

    /**
     * Toggles background mode for testing purposes.
     * @param {boolean} enable - True to enable, false to disable.
     */
    toggleBackgroundMode(enable) {
        if (this.state.platform === 'Cordova' && cordova.plugins?.backgroundMode) {
            if (enable) {
                cordova.plugins.backgroundMode.enable();
                this._log('Background mode manually enabled', 'info');
                this.config.callbacks.onBackgroundModeEnabled?.();
            } else {
                cordova.plugins.backgroundMode.disable();
                this._log('Background mode manually disabled', 'info');
                this.config.callbacks.onBackgroundModeDisabled?.();
            }
        } else {
            this._log('Background mode not supported or not on Cordova platform', 'warning');
        }
    }

    /**
     * Logs messages to console and optionally to a backend.
     * @param {string} message - Log message.
     * @param {string} type - Log type (info, error, transcript, interim, success, warning, metric).
     * @param {Object} [details={}] - Additional details.
     * @private
     */
    _log(message, type, details = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, platform: this.state.platform, type, message, ...details };
        this.state.logs.push(logEntry);
        if (this.state.logs.length > 500) this.state.logs.shift();

        if (this.config.debug || ['error', 'warning', 'transcript', 'success', 'metric'].includes(type)) {
            const logFn = console[type] || console.log;
            logFn(`[${timestamp}] [${this.state.platform}] [${type.toUpperCase()}] ${message}`, details);
        }

        if (this.config.logEndpoint) {
            this._sendLogToBackend(logEntry);
        }

        this.config.callbacks.onStatus?.(message, type === 'error' ? 'danger' : type);
    }

    /**
     * Sends logs to the configured backend endpoint.
     * @param {Object} logEntry - Log entry to send.
     * @private
     */
    async _sendLogToBackend(logEntry) {
        try {
            await fetch(this.config.logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] [ERROR] Failed to send log to backend: ${error.message}`);
        }
    }

    /**
     * Sets up the voice recognition system.
     * @returns {Promise<void>}
     */
    async setupVoiceRecognition() {
        try {
            if (!(await this.checkMicPermission())) {
                this._log('Microphone permission required', 'warning');
                await this.requestMicPermission();
                return this.setupVoiceRecognition();
            }

            if (this.state.platform === 'Web') {
                await this._setupWebSpeechRecognition();
                await this._setupAudioProcessing();
                this._log('Web Speech API with whisper detection initialized', 'success');
            } else if (this.state.platform === 'Cordova') {
                await this._setupCordovaSpeechRecognition();
                this._log('Cordova Speech Recognition initialized', 'success');
            } else {
                throw new Error('Speech recognition not supported');
            }
        } catch (error) {
            this._log('Failed to initialize voice recognition', 'error', { error: error.message });
            this.config.callbacks.onError?.(error.message);
        }
    }

    /**
     * Checks microphone permission status.
     * @returns {Promise<boolean>} True if granted.
     */
    async checkMicPermission() {
        if (this.state.platform === 'Cordova') {
            return new Promise(resolve => {
                cordova.plugins?.speechRecognition?.hasPermission?.(resolve, () => resolve(false)) || resolve(true);
            });
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Requests microphone permission.
     * @returns {Promise<boolean>} True if granted.
     */
    async requestMicPermission() {
        if (this.state.platform === 'Cordova') {
            return new Promise((resolve, reject) => {
                cordova.plugins?.speechRecognition?.requestPermission?.(
                    () => resolve(true),
                    err => {
                        this._log('Cordova microphone permission denied', 'error', { error: err });
                        reject(err);
                    }
                ) || resolve(true);
            });
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            this._log('Web microphone permission denied', 'error', { error: error.message });
            throw error;
        }
    }

    /**
     * Sets up Web Speech API recognition.
     * @private
     */
    async _setupWebSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Web Speech API not available');
        }

        this.state.recognition = new SpeechRecognition();
        this.state.recognition.continuous = this.config.continuous;
        this.state.recognition.interimResults = this.config.interimResults;
        this.state.recognition.lang = this.config.language;

        this.state.recognition.onresult = this._handleResult;
        this.state.recognition.onerror = this._handleError;
        this.state.recognition.onend = this._handleEnd;
        this.state.recognition.onstart = this._handleRecognitionStart;
        this.state.recognition.onspeechstart = this._handleSpeechStart;
        this.state.recognition.onspeechend = this._handleSpeechEnd;
        this.state.recognition.onaudiostart = this._handleAudioStart;
        this.state.recognition.onaudioend = this._handleAudioEnd;

        this.startListening();
    }

    /**
     * Sets up Cordova speech recognition with continuous audio recording.
     * @private
     */
    async _setupCordovaSpeechRecognition() {
        try {
            await this._setupCordovaAudioRecording();
            this._startContinuousAudioProcessing();
            this._log('Cordova continuous listening initialized', 'success');
        } catch (error) {
            this._log('Failed to initialize Cordova continuous listening', 'error', { error: error.message });
            this.config.callbacks.onError?.(error.message);
            await this._recoverFromError();
        }
    }

    /**
     * Sets up persistent audio recording for Cordova.
     * @private
     */
    async _setupCordovaAudioRecording() {
        if (!(await this.checkMicPermission())) {
            await this.requestMicPermission();
        }

        return new Promise((resolve, reject) => {
            const filename = `recording_${Date.now()}.wav`;
            const filePath = cordova.file.cacheDirectory + filename;

            this.state.audioRecorder = new Media(
                filePath,
                () => {
                    this._log('Continuous audio recording initialized', 'success');
                    resolve();
                },
                err => {
                    this._log('Audio recording initialization failed', 'error', { error: err.message });
                    reject(err);
                }
            );

            this.state.audioRecorder.startRecord({
                SampleRate: 16000,
                Channels: 1,
                AudioQuality: 'Low',
                AudioEncoding: 'wav',
                AudioSource: 'Microphone',
                BufferSize: 4096
            });

            this.state.isRecording = true;
            this.state.currentAudioFile = filePath;
        });
    }

    /**
     * Starts continuous audio processing with overlapping buffers for Cordova.
     * @private
     */
    _startContinuousAudioProcessing() {
        if (this.state.audioProcessingInterval) {
            clearInterval(this.state.audioProcessingInterval);
        }

        this.state.audioProcessingInterval = setInterval(async () => {
            if (!this.state.isRecording || !this.state.isListening) return;

            try {
                this.state.audioRecorder.pauseRecord();
                await this._processAudioChunk(this.state.currentAudioFile);
                this.state.audioRecorder.resumeRecord();
            } catch (error) {
                this._log('Error in continuous audio processing', 'error', { error: error.message });
                this.metrics.errorCount++;
                await this._recoverFromError();
            }
        }, this.config.chunkDuration);

        this.state.fileRotationInterval = setInterval(() => {
            if (this.state.isRecording) {
                this._rotateAudioFile();
            }
        }, this.config.fileRotationInterval);
    }

    /**
     * Rotates the audio file to prevent excessive growth.
     * @private
     */
    async _rotateAudioFile() {
        try {
            const newFilename = `recording_${Date.now()}.wav`;
            const newFilePath = cordova.file.cacheDirectory + newFilename;

            this.state.audioRecorder.pauseRecord();
            this.state.audioRecorder.release();

            this.state.audioRecorder = new Media(newFilePath);
            this.state.audioRecorder.startRecord({
                SampleRate: 16000,
                Channels: 1,
                AudioQuality: 'Low',
                AudioEncoding: 'wav',
                BufferSize: 4096
            });

            this.state.currentAudioFile = newFilePath;
            this._log('Rotated audio recording file', 'debug');
        } catch (error) {
            this._log('Error rotating audio file', 'error', { error: error.message });
            this.metrics.errorCount++;
            await this._recoverFromError();
        }
    }

    /**
     * Processes an audio chunk with the speech recognition service.
     * @param {string} filePath - Path to the audio file.
     * @private
     */
    async _processAudioChunk(filePath) {
        try {
            const audioData = await this._readAudioChunk(filePath);
            if (!audioData || audioData.length === 0) return;

            const audioBlob = this._float32ArrayToWavBlob(audioData, 16000);
            const formData = new FormData();
            formData.append('audio', audioBlob, 'chunk.wav');
            formData.append('language', this.config.language);
            formData.append('continuous', 'true');
            formData.append('interim', 'false');

            const response = await fetch('https://api.example.com/speech-to-text', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer YOUR_API_KEY',
                    'X-Request-ID': `voice_${Date.now()}`
                },
                body: formData,
                timeout: 3000
            });

            if (response.ok) {
                const data = await response.json();
                if (data.transcript) {
                    const transcript = data.transcript.toLowerCase().trim().replace(/[^\w\s]/gi, '');
                    this._log(`Recognized: "${transcript}"`, 'transcript');
                    this._processTranscript(transcript);
                    this.metrics.successfulCommands++;
                }
            } else {
                this._log('Recognition API error', 'warning', { status: response.status });
                this.metrics.errorCount++;
            }
        } catch (error) {
            this._log('Audio chunk processing failed', 'error', { error: error.message });
            this.metrics.errorCount++;
        }
    }

    /**
     * Reads an audio chunk from the specified file path.
     * @param {string} filePath - Path to the audio file.
     * @returns {Promise<Float32Array|null>} Audio data or null if unavailable.
     * @private
     */
    async _readAudioChunk(filePath) {
        try {
            return new Promise((resolve, reject) => {
                window.resolveLocalFileSystemURL(filePath, fileEntry => {
                    fileEntry.file(file => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const arrayBuffer = reader.result;
                            const audioContext = new AudioContext({ sampleRate: 16000 });
                            audioContext.decodeAudioData(arrayBuffer, buffer => {
                                const float32Array = buffer.getChannelData(0);
                                audioContext.close();
                                resolve(float32Array);
                            }, err => reject(new Error('Failed to decode audio: ' + err.message)));
                        };
                        reader.onerror = err => reject(new Error('Failed to read file: ' + err.message));
                        reader.readAsArrayBuffer(file);
                    }, err => reject(new Error('Failed to access file: ' + err.message)));
                }, err => reject(new Error('Failed to resolve file: ' + err.message)));
            });
        } catch (error) {
            this._log('Failed to read audio chunk', 'error', { error: error.message });
            return null;
        }
    }

    /**
     * Attempts to recover from errors in Cordova audio processing.
     * @private
     */
    async _recoverFromError() {
        this._log('Attempting error recovery', 'info');
        try {
            if (this.state.audioRecorder) {
                this.state.audioRecorder.release();
                this.state.audioRecorder = null;
            }
            if (this.state.audioProcessingInterval) {
                clearInterval(this.state.audioProcessingInterval);
                this.state.audioProcessingInterval = null;
            }
            if (this.state.fileRotationInterval) {
                clearInterval(this.state.fileRotationInterval);
                this.state.fileRotationInterval = null;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            await this._setupCordovaAudioRecording();
            this._startContinuousAudioProcessing();

            this._log('Recovery successful', 'success');
            this.state.retryCount = 0;
        } catch (error) {
            this._log('Recovery failed', 'error', { error: error.message });
            this.metrics.errorCount++;
            const delay = Math.min(5000, 500 * Math.pow(2, this.state.retryCount));
            this.state.retryCount++;
            setTimeout(() => this._recoverFromError(), delay);
        }
    }

    /**
     * Sets up Web Audio API for whisper detection.
     * @private
     */
    async _setupAudioProcessing() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API not supported');
            }
            this.state.audioContext = new AudioContext();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.state.microphone = this.state.audioContext.createMediaStreamSource(stream);
            this.state.gainNode = this.state.audioContext.createGain();
            this.state.analyserNode = this.state.audioContext.createAnalyser();
            this.state.analyserNode.fftSize = 2048;
            this.state.analyserNode.minDecibels = -90;
            this.state.analyserNode.maxDecibels = -10;
            this.state.analyserNode.smoothingTimeConstant = 0.8;
            this.state.processor = this.state.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1);
            this.state.processor.onaudioprocess = this._processAudio;
            this.state.microphone.connect(this.state.gainNode);
            this.state.gainNode.connect(this.state.analyserNode);
            this.state.analyserNode.connect(this.state.processor);
            this.state.processor.connect(this.state.audioContext.destination);
            this.state.voiceDetectionEnabled = true;
            this._log('Whisper detection enabled', 'success');
        } catch (error) {
            this._log('Audio processing setup failed', 'error', { error: error.message });
            this.metrics.errorCount++;
            this.cleanupAudio();
        }
    }

    /**
     * Processes audio input for voice activity detection.
     * @param {AudioProcessingEvent} event - Audio event.
     * @private
     */
    _processAudio(event) {
        if (!this.state.voiceDetectionEnabled || !this.state.isListening) return;
        const input = event.inputBuffer.getChannelData(0);
        const volume = this._calculateVolume(input);

        if (this.config.adaptiveSensitivity) {
            this._adjustSensitivity(volume);
        }

        if (volume > this.config.sensitivity) {
            this._handleVoiceActivity(volume, input);
        } else if (volume > this.config.whisperSensitivity && volume <= this.config.sensitivity) {
            this._handleWhisperActivity(volume, input);
        } else if (volume < this.config.silenceThreshold) {
            this._handleSilence();
        }
    }

    /**
     * Adjusts sensitivity based on ambient noise.
     * @param {number} volume - Current audio volume.
     * @private
     */
    _adjustSensitivity(volume) {
        this.state.peakVolume = Math.max(this.state.peakVolume, volume);
        this.state.avgVolume = this.state.avgVolume * 0.9 + volume * 0.1;
        if (this.state.avgVolume < this.state.noiseFloor * 1.5) {
            this.state.noiseFloor = this.state.avgVolume;
            this.config.sensitivity = Math.min(this.state.noiseFloor * 3, 0.08);
            this.config.whisperSensitivity = Math.min(this.state.noiseFloor * 1.5, 0.03);
            if (this.config.debug) {
                this._log(`Adaptive sensitivity adjusted: sensitivity=${this.config.sensitivity.toFixed(4)}, whisperSensitivity=${this.config.whisperSensitivity.toFixed(4)}`, 'info');
            }
        }
    }

    /**
     * Calculates average volume of audio input.
     * @param {Float32Array} input - Audio samples.
     * @returns {number} Average volume.
     * @private
     */
    _calculateVolume(input) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
            sum += Math.abs(input[i]);
        }
        return sum / input.length;
    }

    /**
     * Handles detected voice activity.
     * @param {number} volume - Calculated volume.
     * @param {Float32Array} input - Audio samples.
     * @private
     */
    _handleVoiceActivity(volume, input) {
        if (this.state.silenceTimer) {
            clearTimeout(this.state.silenceTimer);
            this.state.silenceTimer = null;
        }
        this._bufferAudio(input);
        if (this.state.lowVoiceMode) {
            this.state.lowVoiceMode = false;
            this.setSensitivity(0.08);
            if (this.state.gainNode) this.state.gainNode.gain.value = 1.0;
            this._log('Normal voice detected, sensitivity reset', 'info');
        }
        this.state.lastActivity = Date.now();
    }

    /**
     * Handles whisper/low-volume speech.
     * @param {number} volume - Calculated volume.
     * @param {Float32Array} input - Audio samples.
     * @private
     */
    _handleWhisperActivity(volume, input) {
        if (this.state.silenceTimer) {
            clearTimeout(this.state.silenceTimer);
            this.state.silenceTimer = null;
        }
        this._bufferAudio(input);
        if (!this.state.lowVoiceMode) {
            this.state.lowVoiceMode = true;
            this.setSensitivity(this.config.whisperSensitivity);
            if (this.state.gainNode) this.state.gainNode.gain.value = 1.5;
            this._log('Whisper detected - sensitivity increased', 'info');
            this.metrics.whisperDetections++;
            this.config.callbacks.onWhisperDetected?.(volume);
        }
        this.state.lastActivity = Date.now();
    }

    /**
     * Buffers audio samples.
     * @param {Float32Array} input - Audio samples.
     * @private
     */
    _bufferAudio(input) {
        const newLength = this.state.buffer.length + input.length;
        if (newLength <= this.config.maxBufferSize) {
            const newBuffer = new Float32Array(newLength);
            newBuffer.set(this.state.buffer);
            newBuffer.set(input, this.state.buffer.length);
            this.state.buffer = newBuffer;
        } else {
            const excess = newLength - this.config.maxBufferSize;
            const newBuffer = new Float32Array(this.config.maxBufferSize);
            newBuffer.set(this.state.buffer.slice(excess));
            newBuffer.set(input, this.config.maxBufferSize - input.length);
            this.state.buffer = newBuffer;
        }
    }

    /**
     * Handles silence after voice activity.
     * @private
     */
    _handleSilence() {
        if (!this.state.silenceTimer && this.state.buffer.length > 0) {
            this.state.silenceTimer = setTimeout(() => {
                this._processRecordedSpeech();
                this.state.buffer = new Float32Array(0);
                this.state.silenceTimer = null;
            }, this.config.silenceTimeout);
        }
    }

    /**
     * Processes buffered audio with an external speech-to-text API.
     * @private
     */
    async _processRecordedSpeech() {
        if (this.state.buffer.length === 0) return;
        this._log('Processing buffered audio', 'info', { bufferLength: this.state.buffer.length });
        try {
            const audioBlob = this._float32ArrayToWavBlob(this.state.buffer, this.state.audioContext?.sampleRate || 16000);
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.wav');
            formData.append('language', this.config.language);

            const response = await fetch('https://api.example.com/speech-to-text', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                const transcript = data.transcript?.toLowerCase?.().trim?.().replace(/[^\w\s]/gi, '') || '';
                if (transcript) {
                    this._log(`Buffered speech transcript: "${transcript}"`, 'transcript', { source: 'buffered_audio' });
                    this._processTranscript(transcript);
                    this.metrics.successfulCommands++;
                } else {
                    this._log('No transcript from API for buffered audio', 'warning');
                }
            } else {
                this._log('External speech API error for buffered audio', 'error', { status: response.status });
                this.metrics.errorCount++;
            }
        } catch (error) {
            this._log('Failed to process buffered audio with API', 'error', { error: error.message });
            this.metrics.errorCount++;
        } finally {
            this.config.callbacks.onBufferedSpeechProcessed?.(this.state.buffer);
            this.state.buffer = new Float32Array(0);
        }
    }

    /**
     * Converts Float32Array to WAV Blob.
     * @param {Float32Array} audioData - Raw audio data (mono).
     * @param {number} sampleRate - Audio sample rate.
     * @returns {Blob} WAV formatted audio blob.
     * @private
     */
    _float32ArrayToWavBlob(audioData, sampleRate) {
        const numChannels = 1;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataLength = audioData.length * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);

        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this._writeString(view, 8, 'WAVE');
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        this._floatTo16BitPCM(view, 44, audioData);

        return new Blob([view], { type: 'audio/wav' });
    }

    /**
     * Writes a string to a DataView.
     * @param {DataView} view - DataView to write to.
     * @param {number} offset - Byte offset.
     * @param {string} string - String to write.
     * @private
     */
    _writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Converts Float32Array to 16-bit PCM and writes to DataView.
     * @param {DataView} output - DataView to write to.
     * @param {number} offset - Byte offset.
     * @param {Float32Array} input - Audio samples.
     * @private
     */
    _floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    /**
     * Handles a 'no speech' error from the Web Speech API.
     * @private
     */
    _handleNoSpeechDetected() {
        this._log('No speech detected.', 'info');
        this.state.buffer = new Float32Array(0);
        if (this.state.silenceTimer) {
            clearTimeout(this.state.silenceTimer);
            this.state.silenceTimer = null;
        }
    }

    /**
     * Logs a transcript (final or interim).
     * @param {SpeechRecognitionResultList} results - The results object from the recognition event.
     * @param {boolean} isFinal - True if this is a final transcript.
     * @private
     */
    _logTranscript(results, isFinal) {
        let transcript = '';
        let confidence = 0;
        let altTranscripts = [];

        for (let i = 0; i < results.length; ++i) {
            const result = results[i];
            for (let j = 0; j < result.length; ++j) {
                const alternative = result[j];
                altTranscripts.push({
                    transcript: alternative.transcript,
                    confidence: alternative.confidence
                });
                if (j === 0) {
                    transcript = alternative.transcript;
                    confidence = alternative.confidence;
                }
            }
        }

        const type = isFinal ? 'transcript' : 'interim';
        this._log(`Transcript (${isFinal ? 'Final' : 'Interim'}): "${transcript}"`, type, {
            confidence: confidence,
            alternatives: altTranscripts
        });
    }

    /**
     * Processes a final speech recognition result.
     * @param {SpeechRecognitionResultList} results - The final recognition results.
     * @private
     */
    _processFinalResult(results) {
        const startTime = performance.now();
        this._logTranscript(results, true);

        for (let i = 0; i < results.length; ++i) {
            const result = results[i];
            const transcript = result[0].transcript.toLowerCase().trim();
            const confidence = result[0].confidence;

            if (confidence >= this.config.confidenceThreshold) {
                this._processTranscript(transcript);
                this.metrics.successfulCommands++;
                this.metrics.averageConfidence = (this.metrics.averageConfidence * (this.metrics.commandsProcessed - 1) + confidence) / this.metrics.commandsProcessed;
            } else {
                this._processLowConfidenceTranscript(transcript, confidence);
            }
        }
        this.metrics.processingTime.push(performance.now() - startTime);
    }

    /**
     * Processes an interim speech recognition result.
     * @param {SpeechRecognitionResultList} results - The interim recognition results.
     * @private
     */
    _processInterimResult(results) {
        this._logTranscript(results, false);
    }

    /**
     * Handles a final transcript with low confidence.
     * @param {string} transcript - The low confidence transcript.
     * @param {number} confidence - The confidence level.
     * @private
     */
    _processLowConfidenceTranscript(transcript, confidence) {
        this._log(`Low confidence transcript: "${transcript}" (Confidence: ${confidence.toFixed(2)})`, 'warning');
        this.state.misrecognizedCommands.push({ transcript, confidence, timestamp: new Date().toISOString() });
        this.config.callbacks.onStatus?.(`Could not understand: "${transcript}". Please try again.`, 'warning');
        this.config.callbacks.onMisrecognizedCommand?.(transcript);
    }

    /**
     * Processes a recognized transcript to find and execute commands using Fuse.js.
     * @param {string} transcript - The recognized speech transcript.
     * @private
     */
    _processTranscript(transcript) {
        const normalizedTranscript = transcript.toLowerCase().trim().replace(/[^\w\s]/gi, '');
        this.metrics.commandsProcessed++;

        const results = this.fuse.search(normalizedTranscript);
        let bestMatch = null;
        let highestPriority = -1;
        let bestScore = 1;

        for (const result of results) {
            const { command, action, priority } = result.item;
            if (normalizedTranscript === command || result.score < bestScore) {
                if (priority > highestPriority) {
                    bestMatch = action;
                    highestPriority = priority;
                    bestScore = result.score;
                }
            }
        }

        if (bestMatch && this.config.callbacks[bestMatch]) {
            this._log(`Executing command: ${bestMatch} for transcript "${transcript}"`, 'success');
            this.config.callbacks[bestMatch]();
        } else {
            this._log(`No command found for transcript: "${transcript}"`, 'warning');
            this.state.misrecognizedCommands.push({ transcript, timestamp: new Date().toISOString() });
            this.config.callbacks.onStatus?.(`No command found for "${transcript}"`, 'warning');
            this.config.callbacks.onMisrecognizedCommand?.(transcript);
        }
    }

    /**
     * Starts the speech recognition process.
     */
    startListening() {
        if (this.state.isListening) {
            this._log('Already listening.', 'info');
            return;
        }

        if (!this.state.recognition && this.state.platform === 'Web') {
            this._log('Web Speech Recognition not initialized. Call setupVoiceRecognition first.', 'error');
            this.config.callbacks.onError?.('Speech recognition not ready.');
            return;
        }

        this.state.retryCount = 0;
        this.state.isListening = true;
        this.state.forceKeepAlive = true;

        if (this.state.platform === 'Web' && this.state.recognition) {
            try {
                this.state.recognition.start();
                this._log('Web Speech Recognition started.', 'info');
            } catch (e) {
                this._log(`Error starting Web Speech Recognition: ${e.message}`, 'error');
                this.state.isListening = false;
                this.config.callbacks.onError?.(`Failed to start recognition: ${e.message}`);
            }
        } else if (this.state.platform === 'Cordova' && this.state.audioRecorder) {
            this._startContinuousAudioProcessing();
            this._log('Cordova audio processing started.', 'info');
        }
        this.config.callbacks.onListeningStart?.();
    }

    /**
     * Stops the speech recognition process.
     */
    stopListening() {
        if (!this.state.isListening) {
            this._log('Not currently listening.', 'info');
            return;
        }

        this.state.isListening = false;
        this.state.forceKeepAlive = false;
        this.state.retryCount = 0;

        if (this.state.platform === 'Web' && this.state.recognition) {
            try {
                this.state.recognition.stop();
                this._log('Web Speech Recognition stopped.', 'info');
            } catch (e) {
                this._log(`Error stopping Web Speech Recognition: ${e.message}`, 'error');
            }
        } else if (this.state.platform === 'Cordova') {
            if (this.state.audioRecorder) {
                this.state.audioRecorder.stopRecord();
                this.state.audioRecorder.release();
                this.state.audioRecorder = null;
                this._log('Cordova audio recording stopped.', 'info');
            }
            if (this.state.audioProcessingInterval) {
                clearInterval(this.state.audioProcessingInterval);
                this.state.audioProcessingInterval = null;
            }
            if (this.state.fileRotationInterval) {
                clearInterval(this.state.fileRotationInterval);
                this.state.fileRotationInterval = null;
            }
        }
        this.config.callbacks.onListeningStop?.();
        this.cleanupAudio();
    }

    /**
     * Handles the 'end' event from Web Speech API with synchronized state.
     * @private
     */
    _handleEnd() {
        this._log('Speech recognition ended.', 'info');
        this.config.callbacks.onListeningStop?.();
        if (this.state.isListening && this.config.autoRestart && this.state.forceKeepAlive) {
            this.state.isListening = false;
            this._restartRecognition();
        }
    }

    /**
     * Restarts speech recognition with robust state checking.
     * @private
     */
    _restartRecognition() {
        if (!this.config.autoRestart || !this.state.forceKeepAlive || this.state.retryCount >= this.config.maxRetries) {
            this._log(`Recognition will not restart. Auto-restart: ${this.config.autoRestart}, Force keep alive: ${this.state.forceKeepAlive}, Retries: ${this.state.retryCount}/${this.config.maxRetries}`, 'info');
            this.stopListening();
            return;
        }

        this.state.retryCount++;
        this._log(`Attempting to restart recognition (Attempt ${this.state.retryCount}/${this.config.maxRetries})...`, 'info');
        this.config.callbacks.onStatus?.('Restarting voice recognition...', 'info');

        setTimeout(() => {
            if (this.state.forceKeepAlive && !this.state.isListening) {
                this.startListening();
            } else {
                this._log('Restart aborted: listening state changed or not forced to keep alive.', 'info');
            }
        }, this.config.retryDelay);
    }

    /**
     * Handles the 'result' event from Web Speech API.
     * @param {SpeechRecognitionEvent} event - The recognition event.
     * @private
     */
    _handleResult(event) {
        if (event.results && event.results.length > 0) {
            const lastResult = event.results[event.results.length - 1];
            if (lastResult.isFinal) {
                this._processFinalResult(event.results);
            } else {
                this._processInterimResult(event.results);
            }
        }
    }

    /**
     * Handles the 'error' event from Web Speech API.
     * @param {SpeechRecognitionErrorEvent} event - The error event.
     * @private
     */
    _handleError(event) {
        this.metrics.errorCount++;
        this._log(`Speech recognition error: ${event.error} - ${event.message}`, 'error');
        this.config.callbacks.onError?.(event.message);

        if (event.error === 'no-speech') {
            this._handleNoSpeechDetected();
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            this._log('Microphone access denied or service not allowed.', 'error');
            this.config.callbacks.onError?.('Microphone access denied. Please enable it in your browser settings.');
            this.stopListening();
        } else if (event.error === 'network') {
            this._log('Network error during speech recognition. Check internet connection.', 'error');
            this._restartRecognition();
        } else if (event.error === 'audio-capture') {
            this._log('Audio capture failed. Microphone might be in use or unavailable.', 'error');
            this.config.callbacks.onError?.('Microphone not available or in use by another application.');
            this._restartRecognition();
        } else {
            this._restartRecognition();
        }
    }

    /**
     * Handles the 'start' event from Web Speech API.
     * @private
     */
    _handleRecognitionStart() {
        this._log('Speech recognition started.', 'info');
        this.state.isListening = true;
        this.state.retryCount = 0;
        this.config.callbacks.onListeningStart?.();
    }

    /**
     * Handles the 'speechstart' event from Web Speech API.
     * @private
     */
    _handleSpeechStart() {
        this._log('Speech detected by recognition service.', 'info');
        this.config.callbacks.onSpeechStart?.();
    }

    /**
     * Handles the 'speechend' event from Web Speech API.
     * @private
     */
    _handleSpeechEnd() {
        this._log('Speech detection ended by recognition service.', 'info');
        this.config.callbacks.onSpeechEnd?.();
    }

    /**
     * Handles the 'audiostart' event from Web Speech API.
     * @private
     */
    _handleAudioStart() {
        this._log('Audio input started.', 'info');
        this.config.callbacks.onAudioStart?.();
    }

    /**
     * Handles the 'audioend' event from Web Speech API.
     * @private
     */
    _handleAudioEnd() {
        this._log('Audio input ended.', 'info');
        this.config.callbacks.onAudioEnd?.();
    }

    /**
     * Cleans up audio processing resources.
     */
    cleanupAudio() {
        if (this.state.silenceTimer) {
            clearTimeout(this.state.silenceTimer);
            this.state.silenceTimer = null;
        }
        if (this.state.processor) {
            this.state.processor.disconnect();
            this.state.processor.onaudioprocess = null;
            this.state.processor = null;
        }
        if (this.state.analyserNode) {
            this.state.analyserNode.disconnect();
            this.state.analyserNode = null;
        }
        if (this.state.gainNode) {
            this.state.gainNode.disconnect();
            this.state.gainNode = null;
        }
        if (this.state.microphone) {
            this.state.microphone.disconnect();
            this.state.microphone.mediaStream.getTracks().forEach(track => track.stop());
            this.state.microphone = null;
        }
        if (this.state.audioContext && this.state.audioContext.state !== 'closed') {
            this.state.audioContext.close().then(() => {
                this._log('AudioContext closed.', 'info');
                this.state.audioContext = null;
            }).catch(e => {
                this._log(`Error closing AudioContext: ${e.message}`, 'error');
            });
        }
        this.state.voiceDetectionEnabled = false;
        this.state.buffer = new Float32Array(0);
        this._log('Audio processing resources cleaned up.', 'info');
    }

    /**
     * Manually sets the voice detection sensitivity.
     * @param {number} sensitivity - The new sensitivity value.
     */
    setSensitivity(sensitivity) {
        if (typeof sensitivity === 'number' && sensitivity >= 0 && sensitivity <= 1) {
            this.config.sensitivity = sensitivity;
            this._log(`Sensitivity manually set to: ${sensitivity.toFixed(4)}`, 'info');
        } else {
            this._log('Invalid sensitivity value. Must be between 0 and 1.', 'warning');
        }
    }

    /**
     * Sets the fuzzy matching threshold.
     * @param {number} threshold - The new threshold value (0.0 to 1.0).
     */
    setFuzzyThreshold(threshold) {
        if (typeof threshold === 'number' && threshold >= 0 && threshold <= 1) {
            this.config.fuzzyThreshold = threshold;
            this._initializeFuzzyMatching();
            this._log(`Fuzzy threshold set to: ${threshold.toFixed(2)}`, 'info');
        } else {
            this._log('Invalid fuzzy threshold value. Must be between 0 and 1.', 'warning');
        }
    }

    /**
     * Gets the current performance metrics.
     * @returns {Object} Current performance metrics.
     */
    getMetrics() {
        const totalCommands = this.metrics.commandsProcessed;
        const successRate = totalCommands > 0 ? ((this.metrics.successfulCommands / totalCommands) * 100).toFixed(2) : 0;
        const avgProcessingTimeMs = this.metrics.processingTime.length > 0
            ? (this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length).toFixed(2) + 'ms'
            : 'N/A';

        return {
            commandsProcessed: totalCommands,
            successfulCommands: this.metrics.successfulCommands,
            successRate: parseFloat(successRate),
            averageConfidence: this.metrics.averageConfidence.toFixed(2),
            averageProcessingTime: avgProcessingTimeMs,
            errorCount: this.metrics.errorCount,
            whisperDetections: this.metrics.whisperDetections,
            logsCount: this.state.logs.length,
            misrecognizedCommands: this.state.misrecognizedCommands.length
        };
    }

    /**
     * Retrieves the last N log entries.
     * @param {number} [count=10] - Number of log entries to retrieve.
     * @returns {Array<Object>} Array of log entries.
     */
    getLogs(count = 10) {
        return this.state.logs.slice(-count);
    }

    /**
     * Retrieves the last N misrecognized commands for feedback.
     * @param {number} [count=10] - Number of misrecognized commands to retrieve.
     * @returns {Array<Object>} Array of misrecognized command entries.
     */
    getMisrecognizedCommands(count = 10) {
        return this.state.misrecognizedCommands.slice(-count);
    }

    /**
     * Sets a specific callback function.
     * @param {string} callbackName - The name of the callback (e.g., 'onSOS').
     * @param {Function} func - The function to set as the callback.
     */
    setCallback(callbackName, func) {
        if (typeof func === 'function' && this.config.callbacks.hasOwnProperty(callbackName)) {
            this.config.callbacks[callbackName] = func;
            this._log(`Callback '${callbackName}' updated.`, 'info');
        } else {
            this._log(`Failed to set callback '${callbackName}'. Invalid function or callback name.`, 'warning');
        }
    }

    /**
     * Adds a new custom command trigger.
     * @param {string} phrase - The command phrase.
     * @param {Object} details - An object containing 'action', 'priority', and optional 'fuzzy' array.
     */
    addTrigger(phrase, details) {
        if (typeof phrase === 'string' && phrase.trim() !== '' && details && details.action) {
            this.config.triggers.set(phrase.toLowerCase().trim(), {
                action: details.action,
                priority: details.priority || 10,
                fuzzy: Array.isArray(details.fuzzy) ? details.fuzzy.map(f => f.toLowerCase().trim()) : []
            });
            this._initializeFuzzyMatching();
            this._log(`Added new trigger: "${phrase}" -> action: ${details.action}`, 'info');
        } else {
            this._log('Invalid trigger phrase or details provided.', 'warning');
        }
    }

    /**
     * Removes a custom command trigger.
     * @param {string} phrase - The command phrase to remove.
     * @returns {boolean} True if the trigger was removed, false otherwise.
     */
    removeTrigger(phrase) {
        if (typeof phrase === 'string' && this.config.triggers.has(phrase.toLowerCase().trim())) {
            this.config.triggers.delete(phrase.toLowerCase().trim());
            this._initializeFuzzyMatching();
            this._log(`Removed trigger: "${phrase}"`, 'info');
            return true;
        }
        this._log(`Trigger "${phrase}" not found.`, 'warning');
        return false;
    }
}