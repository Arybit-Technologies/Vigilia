/**
 * VoiceRecognition class for low-level speech recognition.
 * Supports Web Speech API and Cordova environments with continuous listening,
 * whisper detection, and audio processing.
 * @license Apache License 2.0
 */
class VoiceRecognition {
    /**
     * Constructor for VoiceRecognition
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Initialize logs first to avoid undefined errors in _log
        this._logs = [];

        // Default configuration
        this.config = {
            languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'sw-KE', 'hi-IN'],
            defaultLanguage: 'en-US',
            minConfidence: 0.5,
            maxConfidence: 0.99,
            maxRetries: 5,
            retryDelay: 2000,
            sensitivity: 0.08,
            whisperSensitivity: 0.03,
            debug: false,
            continuousListening: true,
            interimResults: true,
            backgroundMode: false,
            fileRotationInterval: 30000,
            audioChunkDuration: 500,
            audioChunkOverlap: 100,
            apiKey: null, // API key for external speech-to-text service (optional)
            batteryThreshold: 0.2,
            ...options
        };

        // State management
        this.state = {
            platform: null,
            isInitialized: false,
            isListening: false,
            isProcessing: false,
            recognition: null,
            audioContext: null,
            mediaStream: null,
            audioFile: null,
            audioBuffer: [],
            errorCount: 0,
            whisperDetections: 0,
            retryCount: 0,
            voiceDetectionEnabled: true,
            transcript: ''
        };

        // Callbacks with defaults
        this.callbacks = {
            onStatus: (msg, type) => console.log(`[VoiceRecognition][${type}] ${msg}`),
            onError: (msg, details) => console.error(`[VoiceRecognition][Error] ${msg}`, details),
            onResult: (transcript, confidence) => console.log(`[VoiceRecognition][Result] ${transcript}, Confidence: ${confidence}`),
            onWhisperDetected: () => console.log('[VoiceRecognition][Whisper] Whisper detected'),
            ...options.callbacks
        };

        // Bind methods to ensure correct `this` context
        this._boundMethods = {
            startListening: this.startListening.bind(this),
            stopListening: this.stopListening.bind(this),
            setupVoiceRecognition: this.setupVoiceRecognition.bind(this),
            setLanguage: this.setLanguage.bind(this),
            setContinuousListening: this.setContinuousListening.bind(this),
            setSensitivity: this.setSensitivity.bind(this)
        };

        // Initialize platform and UI
        this._detectPlatform();
        this._initElements();

        // Last recognition error state
        this._lastRecognitionError = null;
    }

    /**
     * Detects the runtime platform
     * @private
     */
    _detectPlatform() {
        this._log('Detecting platform...', 'info');
        if (typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
            this.state.platform = 'Cordova';
        } else if (window.SpeechRecognition || window.webkitSpeechRecognition) {
            this.state.platform = 'Web';
        } else {
            throw new Error('Unsupported platform: Web Speech API or Cordova plugin required');
        }
        this._log(`Platform detected: ${this.state.platform}`, 'info');
    }

    /**
     * Initializes DOM elements for UI interaction
     * @private
     */
    _initElements() {
        this.elements = {
            micButton: document.getElementById('micButton'),
            stopButton: document.getElementById('stopButton'),
            clearButton: document.getElementById('clearButton'),
            status: document.getElementById('status'),
            transcript: document.getElementById('transcript'),
            languageSelect: document.getElementById('languageSelect'),
            continuousSelect: document.getElementById('continuousSelect'),
            supportWarning: document.getElementById('supportWarning')
        };

        // Only set up UI if elements exist (for non-browser or minimal setups)
        if (this.state.platform === 'Web') {
            if (this.elements.languageSelect) {
                this.elements.languageSelect.innerHTML = this.config.languages
                    .map(lang => `<option value="${lang}" ${lang === this.config.defaultLanguage ? 'selected' : ''}>${lang}</option>`)
                    .join('');
                this.elements.languageSelect.onchange = (e) => this._boundMethods.setLanguage(e.target.value);
                this.elements.languageSelect.setAttribute('aria-label', 'Select language for voice recognition');
            }

            if (this.elements.micButton) {
                this.elements.micButton.onclick = () => this._boundMethods.setupVoiceRecognition().then(() => this._boundMethods.startListening());
                this.elements.micButton.setAttribute('aria-label', 'Start voice recognition');
            }
            if (this.elements.stopButton) {
                this.elements.stopButton.onclick = this._boundMethods.stopListening;
                this.elements.stopButton.setAttribute('aria-label', 'Stop voice recognition');
            }
            if (this.elements.clearButton) {
                this.elements.clearButton.onclick = () => {
                    this.state.transcript = '';
                    if (this.elements.transcript) this.elements.transcript.textContent = '';
                };
                this.elements.clearButton.setAttribute('aria-label', 'Clear transcript');
            }
            if (this.elements.continuousSelect) {
                this.elements.continuousSelect.onchange = (e) => this._boundMethods.setContinuousListening(e.target.value === 'true');
                this.elements.continuousSelect.setAttribute('aria-label', 'Toggle continuous listening');
            }
        }
    }

    /**
     * Normalizes language code
     * @private
     * @param {string} lang - Language code
     * @returns {string} Normalized language code
     */
    _normalizeLanguage(lang) {
        const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', sw: 'sw-KE', de: 'de-DE', hi: 'hi-IN' };
        return langMap[lang.split('-')[0]] || lang || this.config.defaultLanguage;
    }

    /**
     * Sets the recognition language
     * @param {string} lang - Language code
     */
    setLanguage(lang) {
        this.config.language = this._normalizeLanguage(lang);
        if (this.elements.languageSelect) this.elements.languageSelect.value = this.config.language;
        if (this.state.recognition) this.state.recognition.lang = this.config.language;
        this._emitStatus(`Language set to ${this.config.language}`, 'info');
    }

    /**
     * Sets continuous listening mode
     * @param {boolean} enabled - Enable/disable continuous listening
     */
    setContinuousListening(enabled) {
        this.config.continuousListening = !!enabled;
        if (this.state.recognition) this.state.recognition.continuous = this.config.continuousListening;
        this._emitStatus(`Continuous listening ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }

    /**
     * Sets sensitivity for audio detection
     * @param {number} value - Sensitivity value (0 to 1)
     */
    setSensitivity(value) {
        if (value < 0 || value > 1) throw new Error('Sensitivity must be between 0 and 1');
        this.config.sensitivity = value;
        this._log(`Sensitivity set to ${value}`, 'info');
    }

    /**
     * Validates configuration
     * @private
     * @throws {Error} If validation fails
     */
    _validateConfig() {
        const errors = [];
        const lang = this.config.language || this.config.defaultLanguage;
        if (!this.config.languages.includes(lang)) {
            errors.push(`Unsupported language: ${lang}`);
        }
        if (this.config.minConfidence < 0 || this.config.maxConfidence > 1 || this.config.minConfidence > this.config.maxConfidence) {
            errors.push(`Invalid confidence range: ${this.config.minConfidence}-${this.config.maxConfidence}`);
        }
        if (this.config.maxRetries < 0) {
            errors.push(`Max retries cannot be negative: ${this.config.maxRetries}`);
        }
        if (this.state.platform === 'Cordova' && !this.config.apiKey && !cordova.plugins?.speechRecognition) {
            errors.push('API key or Cordova speech plugin required for Cordova');
        }
        if (errors.length) throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    /**
     * Sets up the voice recognition system
     * @param {boolean} force - Force reinitialization
     * @returns {Promise<boolean>} Initialization success
     */
    async setupVoiceRecognition(force = false) {
        if (this.state.isInitialized && !force) {
            this.state.retryCount = 0;
            this._emitStatus('Voice recognition already initialized', 'success');
            return true;
        }
        if (this.state.isProcessing) {
            this._emitStatus('Initialization in progress', 'info');
            return false;
        }
        this.state.isProcessing = true;

        try {
            this._validateConfig();
            await this._checkPermissions();
            if (this.state.platform === 'Web') {
                await this._setupWebRecognition();
            } else {
                await this._setupCordovaRecognition();
            }
            await this._setupAudioProcessing();
            this.state.isInitialized = true;
            this.state.isProcessing = false;
            this.state.retryCount = 0;
            this._emitStatus('Voice recognition initialized', 'success');
            return true;
        } catch (error) {
            this.state.isProcessing = false;
            this._handleError('Initialization failed', { error });
            return false;
        }
    }

    /**
     * Checks microphone permissions
     * @private
     * @throws {Error} If permissions are denied
     */
    async _checkPermissions() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                this.state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this._log('Microphone permissions validated', 'success');
            } catch (error) {
                throw new Error(`Microphone access denied: ${error.message}`);
            }
        }
    }

    /**
     * Sets up Web Speech API recognition
     * @private
     */
    async _setupWebRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (this.elements.supportWarning) this.elements.supportWarning.style.display = 'block';
            throw new Error('Web Speech API not supported');
        }
        if (this.elements.supportWarning) this.elements.supportWarning.style.display = 'none';

        this.state.recognition = new SpeechRecognition();
        this.state.recognition.lang = this.config.language || this.config.defaultLanguage;
        this.state.recognition.continuous = this.config.continuousListening;
        this.state.recognition.interimResults = this.config.interimResults;

        this.state.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join(' ')
                .trim();
            const confidence = Math.min(Math.max(event.results[0][0].confidence || 0.9, this.config.minConfidence), this.config.maxConfidence);
            this.state.transcript = transcript;
            if (this.elements.transcript) this.elements.transcript.textContent = transcript;
            this._log(`Transcript: ${transcript} (Confidence: ${confidence})`, 'transcript');
            this.callbacks.onResult(transcript, confidence);
        };

        this.state.recognition.onerror = (event) => {
            this._lastRecognitionError = event.error;
            this._handleError(event.error, { event });
        };

        this.state.recognition.onstart = () => {
            this.state.isListening = true;
            this.state.retryCount = 0;
            this._emitStatus('Voice recognition started', 'success');
        };

        this.state.recognition.onend = () => {
            this.state.isListening = false;
            this._emitStatus('Voice recognition stopped', 'info');
            if (
                this.config.continuousListening &&
                this.state.voiceDetectionEnabled &&
                !['aborted', 'audio-capture'].includes(this._lastRecognitionError)
            ) {
                this._restartRecognition();
            }
            this._lastRecognitionError = null;
        };

        this._log('Web Speech API recognition setup complete', 'info');
    }

    /**
     * Sets up Cordova speech recognition
     * @private
     */
    async _setupCordovaRecognition() {
        if (!cordova.plugins?.speechRecognition) {
            throw new Error('Cordova speech recognition plugin not found');
        }
        try {
            const available = await new Promise((resolve, reject) => {
                cordova.plugins.speechRecognition.isRecognitionAvailable(resolve, reject);
            });
            if (!available) throw new Error('Speech recognition not available');

            const hasPermission = await new Promise((resolve, reject) => {
                cordova.plugins.speechRecognition.hasPermission(resolve, reject);
            });
            if (!hasPermission) {
                await new Promise((resolve, reject) => {
                    cordova.plugins.speechRecognition.requestPermission(resolve, reject);
                });
            }
            await this._initializeBackgroundMode();
            await this._setupCordovaAudioRecording();
            this._log('Cordova speech recognition setup complete', 'info');
        } catch (error) {
            throw new Error(`Cordova setup failed: ${error.message}`);
        }
    }

    /**
     * Initializes background mode for Cordova
     * @private
     */
    async _initializeBackgroundMode() {
        if (this.config.backgroundMode && cordova.plugins?.backgroundMode) {
            cordova.plugins.backgroundMode.setDefaults({
                title: 'Vigilia Voice Recognition',
                text: 'Listening in background...',
                silent: false
            });
            cordova.plugins.backgroundMode.enable();
            this._log('Background mode enabled', 'info');
            window.addEventListener('batterystatus', (status) => {
                this.state.voiceDetectionEnabled = status.level >= this.config.batteryThreshold * 100;
                this._log(`Voice detection ${this.state.voiceDetectionEnabled ? 'enabled' : 'paused'} due to battery level: ${status.level}%`, 'info');
            });
        }
    }

    /**
     * Sets up audio processing for whisper detection
     * @private
     */
    async _setupAudioProcessing() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext || !this.state.mediaStream) {
            this._log('Web Audio API or media stream not available, whisper detection disabled', 'warning');
            return;
        }
        try {
            this.state.audioContext = new AudioContext();
            const source = this.state.audioContext.createMediaStreamSource(this.state.mediaStream);
            const analyser = this.state.audioContext.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            this._startWhisperDetection(analyser);
        } catch (error) {
            this._log('Failed to set up audio processing', 'error', { error });
        }
    }

    /**
     * Starts whisper detection
     * @private
     * @param {AnalyserNode} analyser - Audio analyser node
     */
    _startWhisperDetection(analyser) {
        const dataArray = new Uint8Array(analyser.fftSize);
        const detectWhisper = () => {
            if (!this.state.isListening || !this.state.voiceDetectionEnabled) {
                requestAnimationFrame(detectWhisper);
                return;
            }
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const value = (dataArray[i] / 128) - 1;
                sum += value * value;
            }
            const volume = Math.sqrt(sum / dataArray.length);
            if (volume >= this.config.whisperSensitivity && volume < this.config.sensitivity) {
                this.state.whisperDetections++;
                this.callbacks.onWhisperDetected();
                this._adjustSensitivity(true);
                this._log('Whisper detected', 'info');
            } else {
                this._adjustSensitivity(false);
            }
            requestAnimationFrame(detectWhisper);
        };
        requestAnimationFrame(detectWhisper);
    }

    /**
     * Adjusts sensitivity for whisper detection
     * @private
     * @param {boolean} isWhisper - Whether whisper mode is active
     */
    _adjustSensitivity(isWhisper) {
        if (isWhisper) {
            this.config.sensitivity = Math.max(this.config.whisperSensitivity, this.config.sensitivity * 0.8);
            if (this.state.audioContext) {
                const gainNode = this.state.audioContext.createGain();
                gainNode.gain.value = 1.5;
                this._log('Sensitivity adjusted for whisper', 'info');
            }
        } else {
            this.config.sensitivity = Math.min(0.08, this.config.sensitivity * 1.1);
        }
    }

    /**
     * Sets up Cordova audio recording
     * @private
     */
    async _setupCordovaAudioRecording() {
        this.state.audioFile = `vigilia_audio_${Date.now()}.wav`;
        await this._startContinuousAudioProcessing();
        this._fileRotationInterval = setInterval(() => this._rotateAudioFile(), this.config.fileRotationInterval);
    }

    /**
     * Rotates audio file in Cordova
     * @private
     */
    _rotateAudioFile() {
        if (this.state.audioFile && this.state.isListening) {
            this.state.audioFile = `vigilia_audio_${Date.now()}.wav`;
            this._log(`Rotated audio file to ${this.state.audioFile}`, 'info');
        }
    }

    /**
     * Starts continuous audio processing in Cordova
     * @private
     */
    async _startContinuousAudioProcessing() {
        try {
            await this._bufferAudio();
            this._audioProcessingInterval = setInterval(async () => {
                if (this.state.isListening && this.state.audioBuffer.length) {
                    const chunk = this.state.audioBuffer.slice(0, this.config.audioChunkDuration / 1000 * 16000);
                    this.state.audioBuffer = this.state.audioBuffer.slice((this.config.audioChunkDuration - this.config.audioChunkOverlap) / 1000 * 16000);
                    await this._processAudioChunk(chunk);
                }
            }, this.config.audioChunkDuration);
        } catch (error) {
            this._handleError('Failed to start continuous audio processing', { error });
        }
    }

    /**
     * Buffers audio in Cordova
     * @private
     */
    async _bufferAudio() {
        if (this.state.platform !== 'Cordova') return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!this.state.audioContext) {
                this.state.audioContext = new AudioContext();
                this.state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            const source = this.state.audioContext.createMediaStreamSource(this.state.mediaStream);
            const processor = this.state.audioContext.createScriptProcessor(4096, 1, 1);
            source.connect(processor);
            processor.connect(this.state.audioContext.destination);
            processor.onaudioprocess = (e) => {
                if (this.state.isListening) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    this.state.audioBuffer.push(...inputData);
                }
            };
            this._log('Started audio buffering', 'info');
        } catch (error) {
            this._handleError('Failed to buffer audio', { error });
        }
    }

    /**
     * Processes audio chunk in Cordova
     * @private
     * @param {Float32Array} chunk - Audio chunk
     */
    async _processAudioChunk(chunk) {
        if (!this.config.apiKey) {
            this._log('No API key provided, using Cordova speech recognition plugin', 'info');
            try {
                const options = {
                    language: this.config.language || this.config.defaultLanguage,
                    matches: 1,
                    showPartial: false
                };
                const result = await new Promise((resolve, reject) => {
                    cordova.plugins.speechRecognition.startListening(resolve, reject, options);
                });
                const transcript = result[0]?.trim();
                const confidence = 0.9; // Default confidence for Cordova
                if (transcript && confidence >= this.config.minConfidence) {
                    this.state.transcript = transcript;
                    if (this.elements.transcript) this.elements.transcript.textContent = transcript;
                    this._log(`Transcript: ${transcript} (Confidence: ${confidence})`, 'transcript');
                    this.callbacks.onResult(transcript, confidence);
                } else {
                    this._log(`Low confidence or empty transcript: ${transcript}`, 'warning');
                }
            } catch (error) {
                this._handleError('Cordova speech recognition failed', { error });
            }
            return;
        }

        let timeoutId;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 3000);
            const wavBlob = this._float32ArrayToWavBlob(chunk);
            const response = await fetch('https://api.speech-to-text.example.com/transcribe', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/octet-stream'
                },
                body: wavBlob,
                signal: controller.signal,
                mode: 'cors'
            });
            clearTimeout(timeoutId);
            const { transcript, confidence } = await response.json();
            this.state.transcript = transcript;
            if (this.elements.transcript) this.elements.transcript.textContent = transcript;
            this._log(`Transcript: ${transcript} (Confidence: ${confidence})`, 'transcript');
            this.callbacks.onResult(transcript, Math.min(Math.max(confidence, this.config.minConfidence), this.config.maxConfidence));
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                this._handleError('API request timed out', { error });
            } else {
                this._handleError('Failed to process audio chunk', { error });
            }
        }
    }

    /**
     * Converts Float32Array to WAV Blob
     * @private
     * @param {Float32Array} audioData - Audio data
     * @returns {Blob} WAV Blob
     */
    _float32ArrayToWavBlob(audioData) {
        const sampleRate = 16000; // Standard for speech recognition
        const numChannels = 1; // Mono
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        const dataSize = audioData.length * (bitsPerSample / 8);

        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // RIFF header
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true); // Chunk size
        this._writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Sub-chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);

        // data sub-chunk
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write PCM data
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Writes string to DataView
     * @private
     * @param {DataView} view - DataView to write to
     * @param {number} offset - Offset in bytes
     * @param {string} string - String to write
     */
    _writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Logs messages
     * @private
     * @param {string} message - Log message
     * @param {string} type - Log type
     * @param {Object} [details] - Additional details
     */
    _log(message, type, details = {}) {
        if (!this.config.debug && !['error', 'warning', 'transcript', 'success'].includes(type)) return;
        const logEntry = { message, type, timestamp: new Date(), details };
        this._logs.push(logEntry);
        if (this._logs.length > 500) this._logs.shift();
        console.log(`[VoiceRecognition][${type}] ${message}`, details);
    }

    /**
     * Emits status messages
     * @private
     * @param {string} message - Status message
     * @param {string} type - Status type
     */
    _emitStatus(message, type = 'info') {
        this.callbacks.onStatus(message, type);
        if (this.elements.status && this.state.platform === 'Web') {
            this.elements.status.textContent = message;
            this.elements.status.className = `alert alert-${type}`;
            this.elements.status.setAttribute('aria-live', 'polite');
        }
    }

    /**
     * Handles errors with retry logic
     * @private
     * @param {string} message - Error message
     * @param {Object} details - Additional details
     */
    _handleError(message, details = {}) {
        this.state.errorCount++;
        this._emitStatus(`Error: ${message}`, 'danger');
        this._log(`Error: ${message}`, 'error', details);
        this.callbacks.onError(message, details);
        if (this.state.retryCount < this.config.maxRetries) {
            this.state.retryCount++;
            const delay = this.config.retryDelay * Math.pow(2, this.state.retryCount);
            this._log(`Retrying in ${delay}ms (Attempt ${this.state.retryCount}/${this.config.maxRetries})`, 'warning');
            setTimeout(() => this._restartRecognition(), delay);
        } else {
            this._emitStatus('Max retries reached, stopping recognition', 'danger');
            this._boundMethods.stopListening();
        }
    }

    /**
     * Restarts recognition
     * @private
     */
    async _restartRecognition() {
        try {
            if (this.state.isListening) await this._boundMethods.stopListening();
            while (this.state.isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Cooldown
            const initialized = await this._boundMethods.setupVoiceRecognition(true);
            if (!initialized) {
                this._log('Recognition re-initialization failed', 'error');
                return;
            }
            await this._boundMethods.startListening();
            this._log('Recognition restarted successfully', 'success');
        } catch (error) {
            this._handleError('Reconnection failed', { error });
        }
    }

    /**
     * Starts listening for voice input
     * @returns {Promise<boolean>} Success status
     */
    async startListening() {
        this._log('Starting voice recognition', 'info');
        if (!this.state.isInitialized) {
            const success = await this._boundMethods.setupVoiceRecognition();
            if (!success) return false;
        }
        if (this.state.isListening) {
            this._emitStatus('Already listening', 'info');
            return true;
        }
        try {
            if (this.state.platform === 'Web') {
                if (this.state.recognition && this.state.isListening) {
                    this._log('Recognition already running', 'warning');
                    return true;
                }
                const recognition = this.state.recognition;
                let startErrorHandler;
                startErrorHandler = (event) => {
                    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        this._log('Microphone permission denied or blocked by browser', 'error', { event });
                        this._emitStatus('Microphone permission denied', 'danger');
                        recognition.removeEventListener('error', startErrorHandler);
                        this.state.isListening = false;
                    } else if (event.error === 'aborted' || event.error === 'audio-capture') {
                        this._log('Audio capture error', 'error', { event });
                        this._emitStatus('Audio capture error', 'danger');
                        recognition.removeEventListener('error', startErrorHandler);
                        this.state.isListening = false;
                    }
                };
                recognition.addEventListener('error', startErrorHandler, { once: true });
                recognition.start();
            } else {
                await this._startContinuousAudioProcessing();
                this.state.isListening = true;
                this._emitStatus('Listening started', 'success');
            }
            return true;
        } catch (error) {
            if (error.message?.includes('recognition has already started')) {
                this._log('Recognition already running (caught in startListening)', 'warning');
                this._emitStatus('Already listening', 'info');
                return true;
            }
            this._handleError('Failed to start listening', { error });
            return false;
        }
    }

    /**
     * Stops listening for voice input
     * @returns {Promise<void>}
     */
    async stopListening() {
        if (!this.state.isListening) {
            this._emitStatus('Not listening', 'info');
            return;
        }
        try {
            if (this.state.platform === 'Web' && this.state.recognition) {
                this.state.recognition.stop();
                this.state.recognition = null;
            }
            if (this.state.mediaStream) {
                this.state.mediaStream.getTracks().forEach(track => track.stop());
                this.state.mediaStream = null;
            }
            if (this.state.audioContext) {
                await this.state.audioContext.close();
                this.state.audioContext = null;
            }
            if (this._audioProcessingInterval) {
                clearInterval(this._audioProcessingInterval);
                this._audioProcessingInterval = null;
            }
            if (this._fileRotationInterval) {
                clearInterval(this._fileRotationInterval);
                this._fileRotationInterval = null;
            }
            this.state.isListening = false;
            this.state.audioBuffer = [];
            this._emitStatus('Listening stopped', 'info');
        } catch (error) {
            this._handleError('Failed to stop listening', { error });
        }
    }

    /**
     * Retrieves logs
     * @returns {Array} Log entries
     */
    getLogs() {
        return this._logs;
    }

    /**
     * Clears logs
     */
    clearLogs() {
        this._logs = [];
        this._log('Logs cleared', 'info');
    }
}