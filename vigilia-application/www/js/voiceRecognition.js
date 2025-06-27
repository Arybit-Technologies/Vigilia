/**
 * VoiceRecognition: Handles voice commands with whisper/low-voice detection for the Vigilia safety app.
 * Supports Web Speech API and Cordova speech recognition, with audio processing for low-volume speech.
 */
class VoiceRecognition {
    constructor(options = {}) {
        // Configuration with defaults
        this.config = {
            language: options.language || window.vigiliaApp?.language || 'en-US', // Sync with VigiliaApp
            continuous: true, // Continuous listening for web
            interimResults: true, // Partial results for real-time processing
            maxRetries: 5, // Increased retries for reliability
            retryDelay: 2000, // Delay between retries (ms)
            confidenceThreshold: 0.7, // Minimum confidence for command execution
            sensitivity: 0.1, // Default volume threshold for voice detection
            whisperSensitivity: 0.05, // Threshold for whisper detection
            silenceThreshold: 0.02, // Threshold for silence detection
            silenceTimeout: 2000, // Silence duration before processing (ms)
            bufferSize: 512, // Audio buffer size for Web Audio API
            debug: false, // Enable console-only logging if true
            triggers: {
                // Emergency commands (multiple variations for robustness)
                'vigilia help': () => this.onSOS(),
                'vigilia sos': () => this.onSOS(),
                'vigil help': () => this.onSOS(),
                'visually help': () => this.onSOS(),
                'vigilante help': () => this.onSOS(),
                'vigilio help': () => this.onSOS(),
                'vigi': () => this.onSOS(),
                'help me': () => this.onSOS(),
                'emergency': () => this.onSOS(),
                'danger': () => this.onSOS(),
                'assist me': () => this.onSOS(),
                'send help': () => this.onSOS(),
                'whisper help': () => this.onSOS(),
                'quiet help': () => this.onSOS(),
                'soft help': () => this.onSOS(),
                // Feature commands
                'take photo': () => this.onCapturePhoto(),
                'snap picture': () => this.onCapturePhoto(),
                'record audio': () => this.onRecordAudio(),
                'start audio': () => this.onRecordAudio(),
                'record video': () => this.onRecordVideo(),
                'start video': () => this.onRecordVideo(),
                'open contacts': () => this.onOpenContacts(),
                'call contacts': () => this.onOpenContacts(),
                'share location': () => this.onShareLocation(),
                'send location': () => this.onShareLocation(),
                'threat detection': () => this.onStartThreatDetection(),
                'start threat detection': () => this.onStartThreatDetection(),
                'safe route': () => this.onOpenSafeRoute(),
                'plan route': () => this.onOpenSafeRoute(),
                'refresh location': () => this.onRefreshLocation(),
                'update location': () => this.onRefreshLocation(),
                'mental health': () => this.onOpenMentalHealth(),
                'help mental health': () => this.onOpenMentalHealth(),
                'encrypted chat': () => this.onOpenEncryptedChat(),
                'secure chat': () => this.onOpenEncryptedChat(),
                'evidence vault': () => this.onOpenEvidence(),
                'open evidence': () => this.onOpenEvidence(),
                'legal aid': () => this.onOpenLegalAid(),
                'open legal aid': () => this.onOpenLegalAid(),
                'safe journey': () => this.onOpenSafeJourney(),
                'start journey': () => this.onOpenSafeJourney(),
                'cyber safety': () => this.onOpenCyberSafety(),
                'open cyber safety': () => this.onOpenCyberSafety(),
                'settings': () => this.onOpenSettings(),
                'open settings': () => this.onOpenSettings(),
                ...(options.triggers || {})
            },
            ...options
        };

        // State variables
        this.speechRecognition = null;
        this.isListening = false;
        this.retryCount = 0;
        this.audioContext = null;
        this.microphone = null;
        this.processor = null;
        this.gainNode = null;
        this.voiceDetectionEnabled = false;
        this.lowVoiceMode = false;
        this.buffer = [];
        this.silenceTimer = null;

        // Feature callbacks mapped to VigiliaApp methods
        this.onSOS = options.onSOS || (() => window.vigiliaApp?.startVoiceSOS());
        this.onCapturePhoto = options.onCapturePhoto || (() => window.vigiliaApp?.capturePhoto());
        this.onRecordAudio = options.onRecordAudio || (() => window.vigiliaApp?.recordAudio());
        this.onRecordVideo = options.onRecordVideo || (() => window.vigiliaApp?.startVideoRecording());
        this.onOpenContacts = options.onOpenContacts || (() => window.openContacts?.());
        this.onShareLocation = options.onShareLocation || (() => window.vigiliaApp?.shareLocation());
        this.onStartThreatDetection = options.onStartThreatDetection || (() => window.vigiliaApp?.startThreatDetection());
        this.onOpenSafeRoute = options.onOpenSafeRoute || (() => window.vigiliaApp?.openSafeRoute());
        this.onRefreshLocation = options.onRefreshLocation || (() => window.vigiliaApp?.updateLocationDetails());
        this.onOpenMentalHealth = options.onOpenMentalHealth || (() => window.vigiliaApp?.openMentalHealth());
        this.onOpenEncryptedChat = options.onOpenEncryptedChat || (() => window.vigiliaApp?.openEncryptedChat());
        this.onOpenEvidence = options.onOpenEvidence || (() => window.openEvidence?.());
        this.onOpenLegalAid = options.onOpenLegalAid || (() => window.openLegalAid?.());
        this.onOpenSafeJourney = options.onOpenSafeJourney || (() => window.openSafeJourney?.());
        this.onOpenCyberSafety = options.onOpenCyberSafety || (() => window.openCyberSafety?.());
        this.onOpenSettings = options.onOpenSettings || (() => window.openSettings?.());
        this.onStatus = options.onStatus || ((msg, type) => {
            const indicator = document.getElementById('recording-indicator');
            if (indicator) {
                indicator.innerHTML = `<span aria-hidden="true">🔴</span> ${msg}`;
                indicator.className = `recording-indicator bg-${type === 'danger' ? 'danger' : 'info'} rounded text-white p-2`;
                indicator.classList.remove('d-none');
                setTimeout(() => indicator.classList.add('d-none'), 3000);
            }
            window.vigiliaApp?.showStatus(msg, type);
            if (this.config.debug) console.log(`[${type.toUpperCase()}] ${msg}`);
        });
    }

    /**
     * Initializes speech recognition and audio processing.
     */
    async setupVoiceRecognition() {
        try {
            if (await this.checkMicPermission()) {
                if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
                    await this._setupWebSpeechRecognition();
                    await this._setupAudioProcessing();
                    console.log('🎤 Voice recognition with whisper detection ready');
                } else if (typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
                    await this._setupCordovaSpeechRecognition();
                    console.log('🎤 Voice recognition ready (Cordova)');
                } else {
                    console.log('❌ Speech recognition not supported on this device');
                    console.error('❌ Speech recognition not supported on this device');
                }
            } else {
                console.log('❌ Microphone permission required');
                await this.requestMicPermission();
                await this.setupVoiceRecognition(); // Retry after permission
            }
        } catch (error) {
            console.error('❌ Failed to initialize voice recognition:', error);
            console.log('❌ Failed to initialize voice recognition');
        }
    }

    /**
     * Checks microphone permission status.
     * @returns {Promise<boolean>} True if permission is granted, false otherwise.
     */
    async checkMicPermission() {
        if (typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
            return new Promise(resolve => {
                cordova.plugins.speechRecognition.hasPermission(
                    hasPermission => resolve(hasPermission),
                    () => resolve(false)
                );
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
     * Requests microphone permission for Web or Cordova.
     * @returns {Promise<boolean>} True if permission is granted, false on error.
     */
    async requestMicPermission() {
        if (typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
            return new Promise((resolve, reject) => {
                cordova.plugins.speechRecognition.requestPermission(
                    () => resolve(true),
                    err => {
                        console.log('❌ Microphone permission denied');
                        console.warn('❌ Speech recognition permission denied:', err);
                        reject(err);
                    }
                );
            });
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.log('❌ Microphone permission denied');
            console.warn('❌ Web microphone permission denied:', error);
            throw error;
        }
    }

    /**
     * Sets up Web Speech API recognition with whisper detection.
     */
    async _setupWebSpeechRecognition() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            this.speechRecognition.continuous = this.config.continuous;
            this.speechRecognition.interimResults = this.config.interimResults;
            this.speechRecognition.lang = this.config.language;

            this.speechRecognition.onresult = event => {
                try {
                    const result = event.results[event.results.length - 1];
                    if (result.isFinal) {
                        this._processFinalResult(result);
                    } else {
                        this._processInterimResult(result);
                    }
                } catch (error) {
                    console.error('❌ Error processing voice command:', error);
                    console.log('❌ Error processing voice command');
                }
            };

            this.speechRecognition.onstart = () => {
                this.isListening = true;
                this.retryCount = 0;
                console.log('🎤 Listening for voice commands...');
            };

            this.speechRecognition.onend = () => {
                this.isListening = false;
                console.log('🎤 Voice recognition stopped');
                this._restartRecognition();
            };

            this.speechRecognition.onerror = event => {
                const errorMessages = {
                    'no-speech': 'No speech detected. Try speaking louder or closer to the microphone.',
                    'audio-capture': 'Microphone access denied. Please enable microphone permissions in your browser settings.',
                    'not-allowed': 'Permission denied for speech recognition. Please allow microphone access.',
                    'network': 'Network error. Please check your connection.'
                };
                const message = errorMessages[event.error] || `Speech recognition failed: ${event.message}`;
                console.error(`❌ Speech recognition error: ${event.error}`, message);
                console.log(`❌ ${message}`);
                if (event.error === 'no-speech') {
                    this._handleNoSpeechDetected();
                }
                this._restartRecognition();
            };

            this.startListening();
        } catch (error) {
            console.error('❌ Failed to setup web speech recognition:', error);
            console.log('❌ Failed to setup web speech recognition');
        }
    }

    /**
     * Sets up Cordova speech recognition.
     */
    async _setupCordovaSpeechRecognition() {
        try {
            const hasPermission = await this.checkMicPermission();
            if (!hasPermission) {
                await this.requestMicPermission();
            }
            this._startCordovaSpeechRecognition();
        } catch (error) {
            console.error('❌ Cordova speech recognition setup failed:', error);
            console.log('❌ Failed to setup speech recognition');
        }
    }

    /**
     * Starts Cordova speech recognition.
     */
    _startCordovaSpeechRecognition() {
        try {
            cordova.plugins.speechRecognition.startListening(
                matches => {
                    if (Array.isArray(matches)) {
                        const transcript = matches.join(' ').toLowerCase().trim();
                        console.log('Voice command detected:', transcript);
                        this._processTranscript(transcript);
                    }
                    setTimeout(() => this._startCordovaSpeechRecognition(), this.config.retryDelay);
                },
                err => {
                    console.error('❌ Speech recognition error:', err);
                    console.log('❌ Speech recognition failed');
                    if (this.retryCount < this.config.maxRetries) {
                        this.retryCount++;
                        setTimeout(() => this._startCordovaSpeechRecognition(), this.config.retryDelay);
                    }
                },
                {
                    language: this.config.language,
                    matches: 3,
                    showPopup: false,
                    prompt: '',
                    partialResults: this.config.interimResults
                }
            );
        } catch (error) {
            console.error('❌ Cordova speech recognition error:', error);
            console.log('❌ Failed to start speech recognition');
        }
    }

    /**
     * Sets up Web Audio API for whisper detection.
     */
    async _setupAudioProcessing() {
        try {
            if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
                console.warn('❌ Web Audio API not supported');
                console.log('❌ Whisper detection unavailable');
                return;
            }
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0; // Default gain
            this.processor = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1);
            this.processor.onaudioprocess = e => this._processAudio(e);
            this.microphone.connect(this.gainNode);
            this.gainNode.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            this.voiceDetectionEnabled = true;
            console.log('🔈 Whisper detection enabled');
        } catch (error) {
            console.error('❌ Audio processing setup error:', error);
            console.log('❌ Failed to setup whisper detection');
        }
    }

    /**
     * Processes audio input for voice activity detection.
     * @param {AudioProcessingEvent} event - Audio processing event.
     */
    _processAudio(event) {
        if (!this.voiceDetectionEnabled) return;
        const input = event.inputBuffer.getChannelData(0);
        const volume = this._calculateVolume(input);
        if (volume > this.config.sensitivity) {
            this._handleVoiceActivity(volume, input);
        } else if (volume > this.config.whisperSensitivity && volume <= this.config.sensitivity) {
            this._handleWhisperActivity(volume, input);
        } else if (volume < this.config.silenceThreshold) {
            this._handleSilence();
        }
    }

    /**
     * Calculates average volume of audio input.
     * @param {Float32Array} input - Audio input samples.
     * @returns {number} Average volume.
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
     * @param {Float32Array} input - Audio input samples.
     */
    _handleVoiceActivity(volume, input) {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        this.buffer.push(...Array.from(input));
        if (this.lowVoiceMode) {
            this.lowVoiceMode = false;
            this.setSensitivity(this.config.sensitivity);
            this.gainNode.gain.value = 1.0; // Reset gain
            console.log('🎤 Normal voice detected');
        }
    }

    /**
     * Handles whisper/low-volume speech.
     * @param {number} volume - Calculated volume.
     * @param {Float32Array} input - Audio input samples.
     */
    _handleWhisperActivity(volume, input) {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        this.buffer.push(...Array.from(input));
        if (!this.lowVoiceMode) {
            this.lowVoiceMode = true;
            this.setSensitivity(this.config.whisperSensitivity);
            this.gainNode.gain.value = 1.5; // Boost audio for recognition
            console.log('🔈 Whisper detected - sensitivity increased');
        }
    }

    /**
     * Handles silence after voice activity.
     */
    _handleSilence() {
        if (!this.silenceTimer && this.buffer.length > 0) {
            this.silenceTimer = setTimeout(() => {
                this._processRecordedSpeech();
                this.buffer = [];
                this.silenceTimer = null;
            }, this.config.silenceTimeout);
        }
    }

    /**
     * Processes buffered audio (placeholder for external API integration).
     */
    _processRecordedSpeech() {
        if (this.buffer.length === 0) return;
        // Placeholder for external API (e.g., Whisper API)
        console.log('Processed speech buffer of length:', this.buffer.length);
        console.log('🎤 Processing recorded speech');
        // TODO: Integrate with external speech recognition API for whisper processing
        // Example: await fetch('https://api.whisper.ai/recognize', { body: this.buffer });
    }

    /**
     * Handles no-speech errors by enabling audio processing.
     */
    _handleNoSpeechDetected() {
        console.log('🔍 No speech detected - enabling enhanced detection');
        this.enableVoiceDetection();
    }

    /**
     * Processes final speech recognition results.
     * @param {SpeechRecognitionResult} result - Recognition result.
     */
    _processFinalResult(result) {
        const transcript = result[0].transcript.toLowerCase().trim().replace(/[^\w\s]/gi, '');
        const confidence = result[0].confidence;
        console.log(`Voice command detected: "${transcript}" (confidence: ${confidence})`);
        if (confidence < this.config.confidenceThreshold) {
            this._processLowConfidenceTranscript(transcript);
            return;
        }
        this._processTranscript(transcript);
        if (this.lowVoiceMode) {
            this.lowVoiceMode = false;
            this.setSensitivity(this.config.sensitivity);
            this.gainNode.gain.value = 1.0; // Reset gain
            console.log('🎤 Normal sensitivity restored');
        }
    }

    /**
     * Processes interim speech recognition results.
     * @param {SpeechRecognitionResult} result - Recognition result.
     */
    _processInterimResult(result) {
        const transcript = result[0].transcript.toLowerCase().trim().replace(/[^\w\s]/gi, '');
        const confidence = result[0].confidence;
        if (confidence < 0.4 && transcript.length > 3) {
            this._processLowConfidenceTranscript(transcript);
        }
    }

    /**
     * Processes low-confidence transcripts for emergency commands.
     * @param {string} transcript - Recognized transcript.
     */
    _processLowConfidenceTranscript(transcript) {
        const emergencyPhrases = ['help', 'sos', 'emergency', 'danger', 'vigilia', 'vigi'];
        if (emergencyPhrases.some(phrase => transcript.includes(phrase))) {
            this.onSOS();
            console.log('🚨 Possible emergency detected');
            console.warn('🚨 Detected possible emergency call:', transcript);
        } else {
            console.log('🎤 Command confidence too low, please repeat');
        }
    }

    /**
     * Matches transcript against triggers and executes actions.
     * @param {string} transcript - Recognized transcript.
     */
    _processTranscript(transcript) {
        let matched = false;
        console.log('🎤 Processing transcript:', transcript);
        for (const [trigger, action] of Object.entries(this.config.triggers)) {
            if (transcript.includes(trigger)) {
                action();
                console.log(`🎤 Executed: ${trigger}`);
                matched = true;
                break;
            }
        }
        if (!matched) {
            console.log('🎤 Unrecognized command');
            console.log('🎤 Unrecognized command:', transcript);
        }
    }

    /**
     * Starts speech recognition.
     */
    startListening() {
        if (this.speechRecognition && !this.isListening) {
            try {
                console.log('Starting voice recognition...');
                this.speechRecognition.start();
            } catch (error) {
                console.error('❌ Failed to start listening:', error);
                console.log('❌ Failed to start voice recognition');
            }
        }
    }

    /**
     * Stops speech recognition and audio processing.
     */
    stopListening() {
        if (this.speechRecognition && this.isListening) {
            try {
                this.speechRecognition.stop();
                this.isListening = false;
                this.speechRecognition = null;
                console.log('🎤 Voice recognition stopped');
            } catch (error) {
                console.error('❌ Failed to stop listening:', error);
                console.log('❌ Failed to stop voice recognition');
            }
        }
        this.cleanupAudio();
    }

    /**
     * Restarts recognition after a failure.
     */
    _restartRecognition() {
        if (this.retryCount < this.config.maxRetries && !this.isListening) {
            this.retryCount++;
            setTimeout(() => this.startListening(), this.config.retryDelay);
        }
    }

    /**
     * Adds a new trigger phrase and action.
     * @param {string} phrase - Trigger phrase.
     * @param {Function} action - Action to execute.
     */
    addTrigger(phrase, action) {
        if (phrase && typeof action === 'function' && !this.config.triggers[phrase.toLowerCase()]) {
            this.config.triggers[phrase.toLowerCase()] = action;
            console.log(`Added trigger: ${phrase}`);
        }
    }

    /**
     * Removes a trigger phrase.
     * @param {string} phrase - Trigger phrase to remove.
     */
    removeTrigger(phrase) {
        if (this.config.triggers[phrase.toLowerCase()]) {
            delete this.config.triggers[phrase.toLowerCase()];
            console.log(`Removed trigger: ${phrase}`);
        }
    }

    /**
     * Sets sensitivity for voice detection.
     * @param {number} value - Sensitivity value (0-1).
     */
    setSensitivity(value) {
        this.config.sensitivity = Math.max(0, Math.min(1, value));
        console.log(`Sensitivity set to: ${this.config.sensitivity}`);
    }

    /**
     * Enables voice activity detection.
     */
    enableVoiceDetection() {
        this.voiceDetectionEnabled = true;
        console.log('🔈 Voice detection enabled');
    }

    /**
     * Disables voice activity detection.
     */
    disableVoiceDetection() {
        this.voiceDetectionEnabled = false;
        console.log('🔈 Voice detection disabled');
    }

    /**
     * Updates the recognition language and restarts if active.
     * @param {string} language - Language code (e.g., 'en-US').
     */
    setLanguage(language) {
        this.config.language = language;
        if (this.speechRecognition) {
            this.speechRecognition.lang = language;
            if (this.isListening) {
                this.stopListening();
                this.startListening();
            }
        }
        console.log(`🌍 Language set to ${language}`);
    }

    /**
     * Cleans up audio processing resources.
     */
    cleanupAudio() {
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.audioContext) {
            this.audioContext.close().catch(err => console.error('Error closing AudioContext:', err));
            this.audioContext = null;
        }
        this.buffer = [];
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        this.lowVoiceMode = false;
        console.log('🔈 Audio processing stopped');
    }
}