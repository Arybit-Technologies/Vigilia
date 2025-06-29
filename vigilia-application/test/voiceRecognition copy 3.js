class VoiceRecognition {
    /**
     * Constructor for VoiceRecognition
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        this.config = {
            language: 'en-US',
            platform: 'Web', // Default to Web; can be overridden as 'Cordova'
            minConfidence: 0.5,
            debug: false,
            autoRestart: true,
            callbacks: {},
            ...config
        };
        this.recognition = null; // Web Speech API instance or Cordova plugin
        this.isListening = false;
        this.stopRequested = false;
        this.audioContext = null; // For whisper detection on Web
        this.stream = null; // Microphone stream for whisper detection
        this.isInitialized = false;

        // Validate configuration
        if (!this.config.callbacks || typeof this.config.callbacks !== 'object') {
            throw new Error('Callbacks object is required');
        }
        if (!['Web', 'Cordova'].includes(this.config.platform)) {
            throw new Error('Invalid platform specified. Use "Web" or "Cordova".');
        }

        // Bind methods
        this.setupVoiceRecognition = this.setupVoiceRecognition.bind(this);
        this.startListening = this.startListening.bind(this);
        this.stopListening = this.stopListening.bind(this);
        this._log = this._log.bind(this);
    }

    /**
     * Sets up the voice recognition system
     * @returns {Promise<boolean>} Initialization success
     */
    async setupVoiceRecognition() {
        if (this.isInitialized) {
            this._log('VoiceRecognition already initialized', 'info');
            return true;
        }

        try {
            if (this.config.platform === 'Web') {
                await this._setupWeb();
            } else if (this.config.platform === 'Cordova') {
                await this._setupCordova();
            }
            this.isInitialized = true;
            this._log('VoiceRecognition initialized successfully', 'success');
            return true;
        } catch (error) {
            this._log(`Initialization failed: ${error.message}`, 'error', { error });
            this.config.callbacks?.onError?.(error.message, error);
            throw error;
        }
    }

    /**
     * Sets up Web Speech API
     * @private
     */
    async _setupWeb() {
        if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
            throw new Error('SpeechRecognition not supported in this browser');
        }

        // Check microphone permissions
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this._log('Microphone access granted', 'info');
            } catch (error) {
                throw new Error(`Microphone access denied: ${error.message}`);
            }
        }

        // Initialize Web Speech API
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.lang = this.config.language;
        this.recognition.continuous = this.config.autoRestart;
        this.recognition.interimResults = false;

        // Setup event handlers
        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            if (result.isFinal) {
                const transcript = result[0].transcript.trim();
                const confidence = result[0].confidence || 0.9; // Fallback for browsers without confidence
                if (confidence >= this.config.minConfidence) {
                    this.config.callbacks?.onResult?.(transcript, confidence);
                } else {
                    this._log(`Low confidence transcript: ${transcript} (${confidence})`, 'warning');
                }
            }
        };

        this.recognition.onerror = (event) => {
            const errorMsg = event.error === 'no-speech' ? 'No speech detected' : event.error;
            this.config.callbacks?.onError?.(errorMsg, event);
            this._log(`Recognition error: ${errorMsg}`, 'error', { event });
            if (event.error === 'network' && this.config.autoRestart) {
                this._handleNetworkError();
            }
        };

        this.recognition.onstart = () => {
            this.isListening = true;
            this.config.callbacks?.onStatus?.('Listening started', 'info');
            this._startWhisperDetection();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.config.callbacks?.onStatus?.('Listening stopped', 'info');
            this._stopWhisperDetection();
            if (this.config.autoRestart && !this.stopRequested) {
                this._log('Auto-restarting recognition', 'info');
                this.startListening();
            }
        };
    }

    /**
     * Sets up Cordova speech recognition
     * @private
     */
    async _setupCordova() {
        if (typeof cordova === 'undefined' || !cordova.plugins?.speechRecognition) {
            throw new Error('Cordova speech recognition plugin not available');
        }
        this.recognition = cordova.plugins.speechRecognition;

        // Check if recognition is available
        const isAvailable = await new Promise((resolve) => {
            this.recognition.isRecognitionAvailable(resolve, (error) => {
                throw new Error(`Recognition availability check failed: ${error}`);
            });
        });

        if (!isAvailable) {
            throw new Error('Speech recognition not available on this device');
        }

        // Check microphone permissions
        const hasPermission = await new Promise((resolve) => {
            this.recognition.hasPermission(resolve, (error) => {
                throw new Error(`Permission check failed: ${error}`);
            });
        });

        if (!hasPermission) {
            await new Promise((resolve, reject) => {
                this.recognition.requestPermission(resolve, reject);
            });
        }
        this._log('Cordova speech recognition setup complete', 'info');
    }

    /**
     * Starts listening for voice input
     * @returns {Promise<boolean>} Success status
     */
    async startListening() {
        if (!this.isInitialized) {
            this._log('Cannot start listening: VoiceRecognition not initialized', 'error');
            return false;
        }
        if (this.isListening) {
            this._log('Already listening', 'info');
            return true;
        }

        try {
            this.stopRequested = false;
            if (this.config.platform === 'Web') {
                this.recognition.start();
            } else if (this.config.platform === 'Cordova') {
                const options = {
                    language: this.config.language,
                    matches: 1,
                    showPartial: false
                };
                await new Promise((resolve, reject) => {
                    this.recognition.startListening(
                        (result) => {
                            const transcript = result[0]?.trim();
                            const confidence = 0.9; // Cordova may not provide confidence
                            if (transcript && confidence >= this.config.minConfidence) {
                                this.config.callbacks?.onResult?.(transcript, confidence);
                            } else {
                                this._log(`Low confidence or empty transcript: ${transcript}`, 'warning');
                            }
                            resolve(true);
                        },
                        (error) => {
                            this.config.callbacks?.onError?.(error, {});
                            this._log(`Cordova listening error: ${error}`, 'error', { error });
                            if (error.includes('network') && this.config.autoRestart) {
                                this._handleNetworkError();
                            }
                            reject(error);
                        },
                        options
                    );
                });
            }
            return true;
        } catch (error) {
            this.config.callbacks?.onError?.(`Start listening failed: ${error.message}`, error);
            this._log(`Start listening failed: ${error.message}`, 'error', { error });
            return false;
        }
    }

    /**
     * Stops listening for voice input
     * @returns {Promise<void>}
     */
    async stopListening() {
        if (!this.isListening) {
            this._log('Not listening', 'info');
            return;
        }
        try {
            this.stopRequested = true;
            if (this.config.platform === 'Web') {
                this.recognition.stop();
            } else if (this.config.platform === 'Cordova') {
                await new Promise((resolve, reject) => {
                    this.recognition.stopListening(resolve, (error) => {
                        this._log(`Cordova stop listening error: ${error}`, 'error', { error });
                        reject(error);
                    });
                });
            }
            this._stopWhisperDetection();
        } catch (error) {
            this.config.callbacks?.onError?.(`Stop listening failed: ${error.message}`, error);
            this._log(`Stop listening failed: ${error.message}`, 'error', { error });
        }
    }

    /**
     * Starts whisper detection (Web only)
     * @private
     */
    _startWhisperDetection() {
        if (this.config.platform !== 'Web' || !this.stream) {
            return; // Whisper detection only supported on Web for now
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            const detectWhisper = () => {
                const buffer = new Float32Array(analyser.fftSize);
                analyser.getFloatTimeDomainData(buffer);
                const amplitude = Math.max(...buffer.map(Math.abs));
                // Threshold for whisper detection (adjust based on testing)
                if (amplitude > 0.01 && amplitude < 0.05) {
                    this.config.callbacks?.onWhisperDetected?.();
                    this._log('Whisper detected', 'info');
                }
                if (this.isListening) {
                    requestAnimationFrame(detectWhisper);
                }
            };
            requestAnimationFrame(detectWhisper);
        } catch (error) {
            this._log(`Whisper detection setup failed: ${error.message}`, 'error', { error });
        }
    }

    /**
     * Stops whisper detection
     * @private
     */
    _stopWhisperDetection() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    /**
     * Handles network errors with retry logic
     * @private
     */
    _handleNetworkError() {
        if (this.config.autoRestart) {
            const delay = 2000 * Math.pow(2, this.config.reconnectAttempts || 0);
            this._log(`Network error detected. Retrying in ${delay}ms...`, 'warning');
            setTimeout(() => this.startListening(), delay);
        }
    }

    /**
     * Logs messages if debug is enabled
     * @private
     * @param {string} message - Log message
     * @param {string} type - Log type
     * @param {Object} [details] - Additional details
     */
    _log(message, type, details = {}) {
        if (this.config.debug || ['error', 'warning'].includes(type)) {
            console.log(`[VoiceRecognition][${type}] ${message}`, details);
            //this.config.callbacks?.onStatus?.(message, type);
        }
    }
}