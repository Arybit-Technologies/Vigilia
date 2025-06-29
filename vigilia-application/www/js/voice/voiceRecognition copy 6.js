/**
 * VoiceRecognition class for web-based speech recognition using Web Speech API.
 * Supports continuous listening, whisper detection (using Web Audio API),
 * and dynamic language/continuity settings.
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
            sensitivity: 0.08,
            whisperSensitivity: 0.03,
            debug: false,
            continuousListening: true,
            interimResults: true,
            ...options
        };

        // State management
        this.state = {
            isInitialized: false,
            isListening: false,
            isProcessing: false,
            recognition: null,
            audioContext: null,
            mediaStream: null,
            audioAnalyser: null,
            errorCount: 0,
            whisperDetections: 0,
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

        // Bind methods
        this._boundMethods = {
            startListening: this.startListening.bind(this),
            stopListening: this.stopListening.bind(this),
            setupVoiceRecognition: this.setupVoiceRecognition.bind(this),
            setLanguage: this.setLanguage.bind(this),
            setContinuousListening: this.setContinuousListening.bind(this),
            setSensitivity: this.setSensitivity.bind(this),
            handleMicButtonClick: this.handleMicButtonClick.bind(this),
            handleStopButtonClick: this.stopListening.bind(this),
            handleClearButtonClick: this.clearTranscript.bind(this),
            handleLanguageChange: this.handleLanguageChange.bind(this),
            handleContinuousChange: this.handleContinuousChange.bind(this)
        };

        // Initialize UI elements and check API support
        this._initElements();
        this._checkWebSpeechApiSupport();
        this.updateUI();
    }

    _log(message, type = 'info', details = null) {
        if (!this.config.debug && type === 'debug') return;
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, message, type, details };
        this._logs.push(logEntry);
        if (this.config.debug || type === 'error' || type === 'warning') {
            console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log'](`[VoiceRecognition - ${type.toUpperCase()}] ${message}`, details || '');
        }
    }

    _emitStatus(message, type = 'info') {
        this.callbacks.onStatus(message, type);
        if (this.elements.status) {
            this.elements.status.textContent = message;
            this.elements.status.className = 'status ' + type;
        }
    }

    _handleError(message, details = null) {
        this._emitStatus(`Error: ${message}`, 'error');
        this.callbacks.onError(message, details);
        this._log(message, 'error', details);
    }

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

        // Populate language select
        if (this.elements.languageSelect) {
            this.elements.languageSelect.innerHTML = this.config.languages
                .map(lang => `<option value="${lang}" ${lang === this.config.defaultLanguage ? 'selected' : ''}>${lang}</option>`)
                .join('');
            this.elements.languageSelect.value = this.config.defaultLanguage;
            this.elements.languageSelect.setAttribute('aria-label', 'Select language for voice recognition');
            this.elements.languageSelect.addEventListener('change', this._boundMethods.handleLanguageChange);
        }

        // Set initial continuous select value
        if (this.elements.continuousSelect) {
            this.elements.continuousSelect.value = String(this.config.continuousListening);
            this.elements.continuousSelect.setAttribute('aria-label', 'Toggle continuous listening');
            this.elements.continuousSelect.addEventListener('change', this._boundMethods.handleContinuousChange);
        }

        // Bind button events
        if (this.elements.micButton) {
            this.elements.micButton.addEventListener('click', this._boundMethods.handleMicButtonClick);
            this.elements.micButton.setAttribute('aria-label', 'Start/Stop voice recognition');
        }
        if (this.elements.stopButton) {
            this.elements.stopButton.addEventListener('click', this._boundMethods.handleStopButtonClick);
            this.elements.stopButton.setAttribute('aria-label', 'Stop voice recognition');
        }
        if (this.elements.clearButton) {
            this.elements.clearButton.addEventListener('click', this._boundMethods.handleClearButtonClick);
            this.elements.clearButton.setAttribute('aria-label', 'Clear transcript');
        }

        this.updateTranscript();
        this._emitStatus('Click the microphone to start recording', 'stopped');
    }

    _checkWebSpeechApiSupport() {
        if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
            if (this.elements.supportWarning) {
                this.elements.supportWarning.style.display = 'block';
                this.elements.supportWarning.textContent = 'Speech Recognition API is not supported by your browser. Please use Chrome, Edge, or a modern browser.';
            }
            if (this.elements.micButton) this.elements.micButton.disabled = true;
            if (this.elements.stopButton) this.elements.stopButton.disabled = true;
            this._handleError('Web Speech API not supported in this browser.');
            return false;
        }
        if (this.elements.supportWarning) this.elements.supportWarning.style.display = 'none';
        return true;
    }

    _normalizeLanguage(lang) {
        const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', sw: 'sw-KE', de: 'de-DE', hi: 'hi-IN' };
        return langMap[lang.split('-')[0]] || lang || this.config.defaultLanguage;
    }

    setLanguage(lang) {
        this.config.defaultLanguage = this._normalizeLanguage(lang);
        if (this.elements.languageSelect) this.elements.languageSelect.value = this.config.defaultLanguage;
        if (this.state.recognition) {
            this.state.recognition.lang = this.config.defaultLanguage;
            if (this.state.isListening) {
                this._log('Language changed while listening, restarting recognition...', 'info');
                this.stopListening();
                this.startListening();
            }
        }
        this._emitStatus(`Language set to ${this.config.defaultLanguage}`, 'info');
    }

    setContinuousListening(enabled) {
        this.config.continuousListening = !!enabled;
        if (this.state.recognition) {
            this.state.recognition.continuous = this.config.continuousListening;
            if (this.state.isListening) {
                this._log('Continuous listening setting changed while listening, restarting recognition...', 'info');
                this.stopListening();
                this.startListening();
            }
        }
        this._emitStatus(`Continuous listening ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }

    setSensitivity(value) {
        if (value < 0 || value > 1) throw new Error('Sensitivity must be between 0 and 1');
        this.config.sensitivity = value;
        this._log(`Sensitivity set to ${value}`, 'info');
    }

    async setupVoiceRecognition(force = false) {
        if (this.state.isInitialized && !force) {
            this._emitStatus('Voice recognition already initialized', 'success');
            return true;
        }
        if (this.state.isProcessing) {
            this._emitStatus('Initialization in progress', 'info');
            return false;
        }
        this.state.isProcessing = true;

        try {
            if (!this._checkWebSpeechApiSupport()) {
                throw new Error('Web Speech API not supported.');
            }
            await this._checkMicrophonePermissions();

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.state.recognition = new SpeechRecognition();

            this.state.recognition.lang = this.config.defaultLanguage;
            this.state.recognition.continuous = this.config.continuousListening;
            this.state.recognition.interimResults = this.config.interimResults;
            this.state.recognition.maxAlternatives = 1;

            this._setupRecognitionEvents();
            await this._setupAudioProcessing();

            this.state.isInitialized = true;
            this.state.isProcessing = false;
            this._emitStatus('Voice recognition initialized', 'success');
            this.updateUI();
            return true;
        } catch (error) {
            this.state.isProcessing = false;
            this._handleError('Initialization failed', { error });
            this.updateUI();
            return false;
        }
    }

    async _checkMicrophonePermissions() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                this.state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this._log('Microphone permissions validated', 'success');
            } catch (error) {
                if (this.elements.micButton) this.elements.micButton.disabled = true;
                if (this.elements.stopButton) this.elements.stopButton.disabled = true;
                throw new Error(`Microphone access denied: ${error.name || error.message}. Please allow microphone access in your browser settings.`);
            }
        } else {
            throw new Error('getUserMedia not supported in this browser for microphone access.');
        }
    }

    _setupRecognitionEvents() {
        if (!this.state.recognition) return;

        this.state.recognition.onstart = () => {
            this.state.isListening = true;
            this._emitStatus('Listening... Speak now', 'listening');
            this.updateUI();
        };

        this.state.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                this.state.transcript += finalTranscript;
                this.updateTranscript();
                const confidence = event.results[event.resultIndex][0].confidence || 0;
                this.callbacks.onResult(finalTranscript.trim(), confidence);
            }

            if (this.config.interimResults && interimTranscript) {
                if (this.elements.transcript) {
                    this.elements.transcript.innerHTML = this.state.transcript +
                        '<span style="color: #999; font-style: italic;">' + interimTranscript + '</span>';
                }
            }
        };

        this.state.recognition.onerror = (event) => {
            let errorMessage = 'Recognition error: ';
            let errorType = 'error';
            switch (event.error) {
                case 'no-speech':
                    errorMessage += 'No speech detected. Please speak clearly.';
                    errorType = 'warning';
                    break;
                case 'audio-capture':
                    errorMessage += 'Audio capture failed. Check microphone.';
                    break;
                case 'not-allowed':
                    errorMessage += 'Microphone access denied. Please grant permission.';
                    break;
                case 'network':
                    errorMessage += 'Network error. Check your connection.';
                    break;
                case 'bad-grammar':
                    errorMessage += 'Bad grammar or unsupported language model.';
                    break;
                default:
                    errorMessage += event.error;
            }
            this._handleError(errorMessage, { event });
            this.stopListening();
        };

        this.state.recognition.onend = () => {
            this.state.isListening = false;
            this.updateUI();
            if (this.state.transcript) {
                this._emitStatus('Recognition completed', 'stopped');
            } else {
                this._emitStatus('Click the microphone to start recording', 'stopped');
            }
            if (this.config.continuousListening &&
                !['aborted', 'audio-capture', 'not-allowed'].includes(this._lastRecognitionError) &&
                !this._explicitStop) {
                this._log('Continuous mode: Recognition ended, restarting...', 'info');
                setTimeout(() => this.startListening(), 100);
            }
            this._lastRecognitionError = null;
            this._explicitStop = false;
        };

        this._log('Web Speech API recognition event handlers setup complete', 'info');
    }

    async startListening() {
        if (!this.state.isInitialized) {
            this._emitStatus('Initializing voice recognition...', 'info');
            const initialized = await this.setupVoiceRecognition();
            if (!initialized) {
                this._handleError('Failed to initialize, cannot start listening.');
                return;
            }
        }

        if (this.state.isListening) {
            this._emitStatus('Already listening.', 'info');
            return;
        }

        if (this.state.recognition) {
            this.state.recognition.lang = this.config.defaultLanguage;
            this.state.recognition.continuous = this.config.continuousListening;
        }

        try {
            this._log('Attempting to start recognition...', 'debug');
            this.state.recognition.start();
        } catch (error) {
            this._handleError(`Error starting recognition: ${error.message}`, { error });
            this.state.isListening = false;
            this.updateUI();
        }
    }

    stopListening() {
        if (this.state.recognition && this.state.isListening) {
            this._explicitStop = true;
            this._log('Attempting to stop recognition...', 'debug');
            this.state.recognition.stop();
            this.state.isListening = false;
            this.updateUI();
            this._emitStatus('Recognition stopped by user.', 'stopped');
        } else {
            this._emitStatus('Not currently listening.', 'info');
        }
    }

    clearTranscript() {
        this.state.transcript = '';
        this.updateTranscript();
        this._emitStatus('Transcript cleared', 'stopped');
    }

    updateTranscript() {
        if (this.elements.transcript) {
            this.elements.transcript.textContent = this.state.transcript || 'Your speech will appear here...';
            if (this.state.transcript) {
                this.elements.transcript.classList.add('has-content');
            } else {
                this.elements.transcript.classList.remove('has-content');
            }
        }
    }

    updateUI() {
        if (this.elements.micButton) {
            if (this.state.isListening) {
                this.elements.micButton.classList.add('recording');
                this.elements.micButton.textContent = '🔴';
            } else {
                this.elements.micButton.classList.remove('recording');
                this.elements.micButton.textContent = '🎤';
            }
            const support = this._checkWebSpeechApiSupport();
            this.elements.micButton.disabled = !support || this.state.isProcessing;
            this.elements.stopButton.disabled = !support || !this.state.isListening;
        }
        if (this.elements.clearButton) {
            this.elements.clearButton.disabled = !this.state.transcript && !this.state.isListening;
        }
        if (this.elements.languageSelect) {
            this.elements.languageSelect.disabled = this.state.isListening;
        }
        if (this.elements.continuousSelect) {
            this.elements.continuousSelect.disabled = this.state.isListening;
        }
    }

    async _setupAudioProcessing() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext || !this.state.mediaStream) {
            this._log('Web Audio API or media stream not available, whisper detection disabled', 'warning');
            return;
        }
        try {
            if (!this.state.audioContext) {
                this.state.audioContext = new AudioContext();
                const source = this.state.audioContext.createMediaStreamSource(this.state.mediaStream);
                const analyser = this.state.audioContext.createAnalyser();
                analyser.fftSize = 512;
                source.connect(analyser);
                const gainNode = this.state.audioContext.createGain();
                gainNode.gain.value = 0;
                analyser.connect(gainNode);
                gainNode.connect(this.state.audioContext.destination);

                this.state.audioAnalyser = analyser;
                this._startWhisperDetection(analyser);
                this._log('Web Audio API setup for whisper detection complete', 'info');
            }
        } catch (error) {
            this._log('Failed to set up audio processing for whisper detection. This may affect whisper feature, but recognition should still work.', 'error', { error });
        }
    }

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
                this._log(`Whisper detected (Volume: ${volume.toFixed(3)})`, 'info');
            } else {
                this._adjustSensitivity(false);
            }
            requestAnimationFrame(detectWhisper);
        };
        requestAnimationFrame(detectWhisper);
    }

    _adjustSensitivity(isWhisper) {
        const defaultSensitivity = 0.08;
        const defaultWhisperSensitivity = 0.03;

        if (isWhisper) {
            this.config.sensitivity = Math.max(defaultWhisperSensitivity, this.config.sensitivity * 0.95);
        } else {
            this.config.sensitivity = Math.min(defaultSensitivity, this.config.sensitivity * 1.02);
        }
        this.config.whisperSensitivity = Math.min(this.config.whisperSensitivity, this.config.sensitivity * 0.8);
    }

    // --- UI Event Handlers ---
    handleMicButtonClick() {
        if (this.state.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    handleLanguageChange(event) {
        if (this.state.isListening) {
            this.stopListening();
            this.setLanguage(event.target.value);
            this.startListening();
        } else {
            this.setLanguage(event.target.value);
        }
    }

    handleContinuousChange(event) {
        const enabled = event.target.value === 'true';
        if (this.state.isListening) {
            this.stopListening();
            this.setContinuousListening(enabled);
            this.startListening();
        } else {
            this.setContinuousListening(enabled);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const voiceRecognition = new VoiceRecognition({
        debug: true,
        continuousListening: true,
        callbacks: {
            onResult: (transcript, confidence) => {
                console.log(`Final result: ${transcript} (Confidence: ${confidence})`);
            },
            onWhisperDetected: () => {
                console.log('Whisper detected!');
            },
            onStatus: (message, type) => {
                const statusElement = document.getElementById('status');
                if (statusElement) {
                    statusElement.textContent = message;
                    statusElement.className = 'status ' + type;
                }
            },
            onError: (message, details) => {
                console.error('Error:', message, details);
            }
        }
    });
});