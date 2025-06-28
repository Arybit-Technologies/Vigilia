/**
 * Basic VoiceRecognition class for use by EnhancedVoiceRecognitionSystem
 */
class VoiceRecognition {
    constructor(options = {}) {
        this.config = {
            ...VOICE_COMMAND_CONFIG,
            ...options,
            maxRetries: options.maxRetries || 5,
            retryDelay: options.retryDelay || 2000,
            confidenceThreshold: options.confidenceThreshold || 0.7,
            debug: options.debug || false,
            autoRestart: options.autoRestart || false,
            adaptiveSensitivity: options.adaptiveSensitivity || false,
            backgroundMode: options.backgroundMode || false
        };
        this.callbacks = options.callbacks || {};
        this.recognition = null;
        this.isListening = false;
        this.isInitialized = false;
        this._isReady = false;
        this._isInitializing = false;
        this.transcript = '';
        this.retryCount = 0;
        this.commandHistory = [];
        this.audioBuffer = [];
        this.language = this._normalizeLanguage(options.language || this.config.defaultLanguage);

        this.initElements();
    }

    /**
     * Normalize language code to full format (e.g., 'en' -> 'en-US')
     */
    _normalizeLanguage(lang) {
        const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', sw: 'sw-KE', de: 'de-DE', hi: 'hi-IN' };
        return langMap[lang] || lang || 'en-US';
    }

    /**
     * Set the recognition language at runtime
     */
    setLanguage(lang) {
        this.language = this._normalizeLanguage(lang);
        if (this.languageSelect) {
            this.languageSelect.value = this.language;
        }
        if (this.recognition) {
            this.recognition.lang = this.language;
        }
        this._emitStatus(`Language set to ${this.language}`, 'info');
    }

    /**
     * Set continuous listening mode at runtime
     */
    setContinuousListening(enabled) {
        this.config.continuousListening = !!enabled;
        if (this.recognition) {
            this.recognition.continuous = !!enabled;
        }
        this._emitStatus(`Continuous listening ${enabled ? 'enabled' : 'disabled'}.`, 'info');
    }

    /**
     * Returns true if system is ready
     */
    isSystemReady() {
        return !!this._isReady;
    }

    initElements() {
        this.micButton = document.getElementById('micButton');
        this.stopButton = document.getElementById('stopButton');
        this.clearButton = document.getElementById('clearButton');
        this.status = document.getElementById('status');
        this.transcriptDiv = document.getElementById('transcript');
        this.languageSelect = document.getElementById('languageSelect');
        this.continuousSelect = document.getElementById('continuousSelect');
        this.supportWarning = document.getElementById('supportWarning');

        // Use normalized language for selection
        if (this.languageSelect) {
            this.languageSelect.innerHTML = this.config.languages.map(lang =>
                `<option value="${lang}" ${lang === this.language ? 'selected' : ''}>
                    ${lang}
                </option>`
            ).join('');
            this.languageSelect.value = this.language;
        }

        // Optional: UI event bindings for demo screen
        if (this.micButton) {
            this.micButton.onclick = () => this.setupVoiceRecognition();
        }
        if (this.stopButton) {
            this.stopButton.onclick = () => this.stopRecognition();
        }
        if (this.clearButton) {
            this.clearButton.onclick = () => {
                this.transcript = '';
                if (this.transcriptDiv) this.transcriptDiv.textContent = '';
            };
        }
        if (this.languageSelect) {
            this.languageSelect.onchange = (e) => this.setLanguage(e.target.value);
        }
        if (this.continuousSelect) {
            this.continuousSelect.onchange = (e) => this.setContinuousListening(e.target.value === "true");
        }
    }

    /**
     * Sets up the voice recognition system
     */
    async setupVoiceRecognition() {
        if (this._isReady) {
            this._emitStatus('VoiceRecognition is already initialized.', 'success');
            return true;
        }
        if (this._isInitializing) {
            this._emitStatus('VoiceRecognition initialization already in progress.', 'info');
            return false;
        }
        this._isInitializing = true;

        try {
            // Check for browser support
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                if (this.supportWarning) this.supportWarning.style.display = '';
                throw new Error('Web Speech API not supported in this browser');
            } else if (this.supportWarning) {
                this.supportWarning.style.display = 'none';
            }

            // Create recognition instance
            this.recognition = new SpeechRecognition();
            this.recognition.lang = this.language;
            this.recognition.continuous = !!this.config.continuousListening;
            this.recognition.interimResults = !!this.config.interimResults;

            // Wire up event handlers
            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join(' ')
                    .trim();
                const confidence = event.results[0][0].confidence;
                this.transcript = transcript;
                if (this.transcriptDiv) this.transcriptDiv.textContent = transcript;
                if (this.config.debug) console.log('[VoiceRecognition] Transcript:', transcript, 'Confidence:', confidence);

                // Callbacks for commands
                if (confidence >= this.config.confidenceThreshold) {
                    for (const key in this.callbacks) {
                        if (key.startsWith('on') && transcript.toLowerCase().includes(key.slice(2).toLowerCase())) {
                            this.callbacks[key](transcript, confidence);
                        }
                    }
                }
            };

            this.recognition.onerror = (event) => {
                if (this.callbacks.onError) {
                    this.callbacks.onError(event.error || event);
                }
                this._emitStatus('Recognition error: ' + (event.error || event), 'danger');
            };

            this.recognition.onstart = () => {
                this._emitStatus('Voice recognition started.', 'info');
                this.isListening = true;
            };

            this.recognition.onend = () => {
                this._emitStatus('Voice recognition stopped.', 'warning');
                this.isListening = false;
                if (this.config.autoRestart) {
                    setTimeout(() => this.recognition.start(), this.config.retryDelay);
                }
            };

            // Start recognition
            this.recognition.start();
            this._isReady = true;
            this._isInitializing = false;
            this._emitStatus('VoiceRecognition initialized and listening.', 'success');
            return true;
        } catch (error) {
            this._isInitializing = false;
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            this._emitStatus('VoiceRecognition failed to initialize: ' + error.message, 'danger');
            return false;
        }
    }

    /**
     * Emits status messages via callback
     */
    _emitStatus(msg, type = 'info') {
        if (this.callbacks.onStatus) {
            this.callbacks.onStatus(msg, type);
        } else if (this.config.debug) {
            console.log(`[VoiceRecognition][${type}] ${msg}`);
        }
        if (this.status) {
            this.status.textContent = msg;
            this.status.className = `alert alert-${type}`;
        }
    }

    /**
     * Stops the recognition system
     */
    async stopRecognition() {
        if (this.recognition) {
            this.recognition.stop();
            this._isReady = false;
            this._emitStatus('VoiceRecognition stopped.', 'info');
        }
    }
}
