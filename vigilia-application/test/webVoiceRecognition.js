/**
 * Voice command configuration schema with validation
 */
const VOICE_COMMAND_CONFIG = {
    languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'sw-KE', 'hi-IN'],
    minConfidence: 0.5,
    maxConfidence: 0.99,
    maxRetryLimit: 10,
    minRetryDelay: 500,
    defaultLanguage: 'en-US',
    criticalCommands: ['SOS', 'emergency', 'help'],
    backgroundProcessingTimeout: 30000
};

/**
 * Enhanced Voice Recognition System for VigiliaApp
 * Combines robust config, error handling, and command registry with fallback and metrics.
 */
class EnhancedVoiceRecognitionSystem {
    constructor(appInstance) {
        this._voiceRecognition = null;
        this._isReady = false;
        this._isInitializing = false;
        this._initializationTime = null;
        this._performanceMetrics = {
            initTime: 0,
            recognitionAccuracy: [],
            successRate: 0,
            totalCommands: 0,
            criticalCommandsProcessed: 0
        };
        this._fallbackSystems = [];
        this._commandQueue = [];
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 3;
        this._app = appInstance; // Reference to VigiliaApp for command handlers
    }

    /**
     * Validates configuration parameters with enhanced checks
     */
    _validateConfig(config) {
        const errors = [];
        if (!VOICE_COMMAND_CONFIG.languages.includes(config.language)) {
            errors.push(`Unsupported language: ${config.language}`);
        }
        if (config.confidenceThreshold < VOICE_COMMAND_CONFIG.minConfidence ||
            config.confidenceThreshold > VOICE_COMMAND_CONFIG.maxConfidence) {
            errors.push(`Confidence threshold must be between ${VOICE_COMMAND_CONFIG.minConfidence} and ${VOICE_COMMAND_CONFIG.maxConfidence}`);
        }
        if (config.maxRetries > VOICE_COMMAND_CONFIG.maxRetryLimit) {
            errors.push(`Max retries cannot exceed ${VOICE_COMMAND_CONFIG.maxRetryLimit}`);
        }
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }
        return true;
    }

    /**
     * Command registry mapping spoken commands to VigiliaApp actions
     */
    get _commandRegistry() {
        // All handlers call methods on the VigiliaApp instance
        return {
            'SOS': { handler: () => this._app.startVoiceSOS(), isCritical: true, alternatives: ['emergency', 'help me', 'mayday'], priority: 1 },
            'emergency': { handler: () => this._app.startVoiceSOS(), isCritical: true, priority: 1 },
            'capture photo': { handler: () => this._app.capturePhoto(), isCritical: false, alternatives: ['take photo', 'snap picture'], priority: 3 },
            'record audio': { handler: () => this._app.recordAudio(), isCritical: false, alternatives: ['start recording'], priority: 3 },
            'record video': { handler: () => this._app.startVideoRecording(), isCritical: false, alternatives: ['start video'], priority: 3 },
            'share location': { handler: () => this._app.shareLocation(), isCritical: false, priority: 2 },
            'safe route': { handler: () => this._app.openSafeRoute(), isCritical: false, alternatives: ['find safe path', 'navigation'], priority: 2 },
            'refresh location': { handler: () => this._app.updateLocationDetails(), isCritical: false, priority: 3 },
            'threat detection': { handler: () => this._app.startThreatDetection(), isCritical: true, priority: 2 },
            'safe journey': { handler: () => this._app.openSafeJourney(), isCritical: false, priority: 2 },
            'open contacts': { handler: () => this._app.openContacts(), isCritical: false, priority: 3 },
            'encrypted chat': { handler: () => this._app.openEncryptedChat(), isCritical: false, alternatives: ['secure chat'], priority: 2 },
            'mental health': { handler: () => this._app.openMentalHealth(), isCritical: false, alternatives: ['counseling', 'support'], priority: 2 },
            'legal aid': { handler: () => this._app.openLegalAid(), isCritical: false, alternatives: ['legal help'], priority: 2 },
            'evidence': { handler: () => this._app.openEvidence(), isCritical: false, alternatives: ['collect evidence'], priority: 2 },
            'cyber safety': { handler: () => this._app.openCyberSafety(), isCritical: false, priority: 3 },
            'settings': { handler: () => this._app.openSettings(), isCritical: false, priority: 3 },
            'help': { handler: () => this.showVoiceHelp(), isCritical: false, alternatives: ['vigilia help', 'voice help'], priority: 3 }
        };
    }

    /**
     * Enhanced initialization with better error handling and fallbacks
     */
    async setupVoiceRecognition() {
        if (this._isReady) {
            this._log('VoiceRecognition system is already initialized.', 'success');
            return true;
        }
        if (this._isInitializing) {
            this._log('VoiceRecognition initialization already in progress.', 'info');
            return false;
        }
        this._isInitializing = true;
        const startTime = performance.now();

        try {
            const config = {
                language: this._app.language || VOICE_COMMAND_CONFIG.defaultLanguage,
                maxRetries: 5,
                retryDelay: 2000,
                confidenceThreshold: 0.7,
                debug: true,
                autoRestart: true,
                adaptiveSensitivity: true,
                backgroundMode: false,
                continuousListening: true,
                interimResults: true,
                callbacks: this._buildCommandCallbacks()
            };
            this._validateConfig(config);

            // Initialize primary system
            await this._initializePrimarySystem(config);

            this._isReady = true;
            this._isInitializing = false;
            this._initializationTime = new Date();
            this._performanceMetrics.initTime = performance.now() - startTime;

            this._log('Voice commands activated! Say "Vigilia help" for options.', 'success');
            this._processCommandQueue();
            return true;
        } catch (error) {
            this._isInitializing = false;
            this._log('❌ VoiceRecognition initialization failed: ' + error.message, 'danger');
            // Optionally: Try fallback system here
            return false;
        }
    }

    /**
     * Initializes the primary voice recognition system with enhanced callbacks
     */
    async _initializePrimarySystem(config) {
        this._voiceRecognition = new VoiceRecognition({
            ...config,
            callbacks: {
                ...config.callbacks,
                onStatus: (msg, type) => this._handleStatusUpdate(msg, type),
                onError: (error) => this._handleRecognitionError(error),
                onBufferedSpeechProcessed: (audioBuffer) => this._processAudioBuffer(audioBuffer)
            }
        });
        await this._voiceRecognition.setupVoiceRecognition();
    }

    /**
     * Builds command callbacks from registry with enhanced mapping
     */
    _buildCommandCallbacks() {
        const callbacks = {};
        Object.entries(this._commandRegistry).forEach(([command, config]) => {
            const callbackName = `on${command.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`;
            callbacks[callbackName] = async (...args) => {
                try {
                    this._performanceMetrics.totalCommands++;
                    if (config.isCritical) this._performanceMetrics.criticalCommandsProcessed++;
                    await config.handler(...args);
                } catch (error) {
                    this._log(`Error executing command ${command}: ${error.message}`, 'danger');
                }
            };
            // Add alternative command mappings
            if (config.alternatives) {
                config.alternatives.forEach(alt => {
                    const altCallbackName = `on${alt.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`;
                    callbacks[altCallbackName] = callbacks[callbackName];
                });
            }
        });
        return callbacks;
    }

    /**
     * Enhanced status update handling with categorization
     */
    _handleStatusUpdate(msg, type) {
        this._log(msg, type);
        if (type === 'success') this._updateSuccessRate();
    }

    /**
     * Enhanced error handling with automatic recovery
     */
    _handleRecognitionError(error) {
        this._log(`VoiceRecognition Error: ${error.message || error}`, 'danger');
        if (typeof error === 'string') error = { message: error };
        if (error.message?.includes('network') || error.message?.includes('connection')) {
            this._handleConnectionLoss();
        } else if (error.message?.includes('permissions') || error.message?.includes('microphone')) {
            this._log('Microphone access required for voice commands', 'warning');
        } else if (this._shouldAttemptRestart(error.message || '')) {
            this._scheduleRestart();
        }
    }

    /**
     * Handles connection loss with automatic reconnection
     */
    _handleConnectionLoss() {
        this._log('Voice recognition connection lost. Attempting to reconnect...', 'warning');
        if (this._reconnectAttempts < this._maxReconnectAttempts) {
            this._reconnectAttempts++;
            setTimeout(() => this._attemptReconnection(), 2000 * this._reconnectAttempts);
        } else {
            this._log('Voice reconnection failed.', 'danger');
        }
    }

    /**
     * Attempts to reconnect the voice system
     */
    async _attemptReconnection() {
        try {
            if (this._voiceRecognition) {
                await this._voiceRecognition.setupVoiceRecognition();
                this._handleReconnection();
            }
        } catch (error) {
            this._handleConnectionLoss();
        }
    }

    /**
     * Handles successful reconnection
     */
    _handleReconnection() {
        this._log('Voice recognition reconnected successfully', 'success');
        this._reconnectAttempts = 0;
        this._processCommandQueue();
    }

    /**
     * Processes queued commands after reconnection
     */
    _processCommandQueue() {
        if (this._commandQueue.length > 0) {
            this._commandQueue.forEach(command => {
                try { command(); } catch (error) { }
            });
            this._commandQueue = [];
        }
    }

    /**
     * Updates success rate metrics
     */
    _updateSuccessRate() {
        const accurateResults = this._performanceMetrics.recognitionAccuracy.filter(x => x).length;
        const totalResults = this._performanceMetrics.recognitionAccuracy.length;
        this._performanceMetrics.successRate = totalResults > 0 ?
            (accurateResults / totalResults) * 100 : 0;
    }

    /**
     * Shows available voice commands help
     */
    showVoiceHelp() {
        const commands = Object.keys(this._commandRegistry);
        const criticalCommands = commands.filter(cmd => this._commandRegistry[cmd].isCritical);
        this._log('Say: ' + criticalCommands.join(', ') + ' for emergency. See console for all commands.', 'info');
        console.log('Available Voice Commands:', commands);
    }

    /**
     * Determines if system should attempt restart based on error
     */
    _shouldAttemptRestart(error) {
        const restartableErrors = ['timeout', 'initialization', 'setup'];
        return restartableErrors.some(err => error.toLowerCase().includes(err));
    }

    /**
     * Schedules a system restart
     */
    _scheduleRestart() {
        this._log('Scheduling voice system restart...', 'warning');
        setTimeout(async () => {
            this._isReady = false;
            this._voiceRecognition = null;
            await this.setupVoiceRecognition();
        }, 5000);
    }

    // Public API methods

    isSystemReady() { return this._isReady; }

    getPerformanceMetrics() {
        return {
            ...this._performanceMetrics,
            uptime: this._initializationTime ? (new Date() - this._initializationTime) / 1000 : 0,
            reconnectAttempts: this._reconnectAttempts,
            hasFallbacks: this._fallbackSystems.length > 0
        };
    }

    getAvailableCommands() {
        const commands = {};
        Object.entries(this._commandRegistry).forEach(([cmd, config]) => {
            const priority = config.priority || 3;
            if (!commands[priority]) commands[priority] = [];
            commands[priority].push({
                command: cmd,
                critical: config.isCritical,
                alternatives: config.alternatives || []
            });
        });
        return commands;
    }

    async triggerCommand(commandName) {
        const command = this._commandRegistry[commandName];
        if (command) {
            try {
                await command.handler();
                return true;
            } catch (error) {
                this._log(`Failed to trigger command ${commandName}: ${error.message}`, 'danger');
                return false;
            }
        }
        return false;
    }

    async shutdown() {
        this._isReady = false;
        if (this._voiceRecognition) {
            try { await this._voiceRecognition.stopRecognition(); } catch (error) { }
        }
        this._fallbackSystems.forEach(system => {
            try { system.shutdown?.(); } catch (error) { }
        });
        this._log('Voice commands deactivated', 'info');
    }
}

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
        this.isInitializing = false;
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

    setContinuousListening(enabled) {
        this.config.continuousListening = !!enabled;
        if (this.recognition) {
            this.recognition.continuous = !!enabled;
        }
        this._emitStatus(`Continuous listening ${enabled ? 'enabled' : 'disabled'}.`, 'info');
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
                throw new Error('Web Speech API not supported in this browser');
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
                if (this.config.debug) console.log('[VoiceRecognition] Transcript:', transcript, 'Confidence:', confidence);

                // Callbacks for commands
                if (confidence >= this.config.confidenceThreshold) {
                    // Try to match a command callback
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
            };

            this.recognition.onstart = () => {
                this._emitStatus('Voice recognition started.', 'info');
            };

            this.recognition.onend = () => {
                this._emitStatus('Voice recognition stopped.', 'warning');
                if (this.config.autoRestart) {
                    setTimeout(() => this.recognition.start(), this.retryDelay);
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