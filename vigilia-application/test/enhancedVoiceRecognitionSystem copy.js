/**
 * EnhancedVoiceRecognitionSystem class for the Vigilia safety app.
 * Integrates VoiceRecognition with command handling, fuzzy matching, and performance monitoring.
 * @license Apache License 2.0
 */
class EnhancedVoiceRecognitionSystem {
    /**
     * Constructor for EnhancedVoiceRecognitionSystem
     * @param {Object} appInstance - Vigilia app instance
     * @param {Object} options - Configuration options
     */
    constructor(appInstance, options = {}) {       

        if (!appInstance || typeof appInstance.showStatus !== 'function') {
            throw new Error('Valid appInstance with showStatus method required');
        }

        this._app = appInstance;
        this.config = {
            fuzzyThreshold: 0.4,
            maxReconnectAttempts: 3,
            minConfidence: 0.5,
            debug: false,
            autoRestart: true,
            ...options
        };
        this._voiceRecognition = null;
        this._isReady = false;
        this._isInitializing = false;
        this._initializationTime = null;
        this._performanceMetrics = {
            initTime: 0,
            commandsProcessed: 0,
            successfulCommands: 0,
            criticalCommandsProcessed: 0,
            averageConfidence: 0,
            totalProcessingTime: 0,
            errorCount: 0,
            whisperDetections: 0,
            misrecognizedCommands: []
        };
        this._commandQueue = [];
        this._reconnectAttempts = 0;
        this._logs = [];

        // Initialize Fuse.js
        if (typeof Fuse === 'undefined') {
            throw new Error('Fuse.js library is required for fuzzy matching');
        }
        this._fuse = new Fuse([...this._commandRegistry.keys()], {
            threshold: this.config.fuzzyThreshold,
            includeScore: true,
            ignoreLocation: true
        });

        // Bind methods
        this.setupVoiceRecognition = this.setupVoiceRecognition.bind(this);
        this._startPeriodicLogging();
    }

    /**
     * Command registry
     * @private
     */
    get _commandRegistry() {
        return new Map([
            ['vigilia sos', { action: () => this._app.startVoiceSOS(), priority: 1, fuzzy: ['sos', 'emergency', 'help me', 'mayday'], isCritical: true }],
            ['capture photo', { action: () => this._app.capturePhoto(), priority: 3, fuzzy: ['take photo', 'snap picture'] }],
            ['record audio', { action: () => this._app.recordAudio(), priority: 3, fuzzy: ['start recording'] }],
            ['record video', { action: () => this._app.startVideoRecording(), priority: 3, fuzzy: ['start video'] }],
            ['share location', { action: () => this._app.shareLocation(), priority: 2, fuzzy: [] }],
            ['safe route', { action: () => this._app.openSafeRoute(), priority: 2, fuzzy: ['find safe path', 'navigation'] }],
            ['refresh location', { action: () => this._app.updateLocationDetails(), priority: 3, fuzzy: [] }],
            ['threat detection', { action: () => this._app.startThreatDetection(), priority: 2, fuzzy: [], isCritical: true }],
            ['safe journey', { action: () => this._app.openSafeJourney(), priority: 2, fuzzy: [] }],
            ['open contacts', { action: () => this._app.openContacts(), priority: 3, fuzzy: [] }],
            ['encrypted chat', { action: () => this._app.openEncryptedChat(), priority: 2, fuzzy: ['secure chat'] }],
            ['mental health', { action: () => this._app.openMentalHealth(), priority: 2, fuzzy: ['counseling', 'support'] }],
            ['legal aid', { action: () => this._app.openLegalAid(), priority: 2, fuzzy: ['legal help'] }],
            ['evidence', { action: () => this._app.openEvidence(), priority: 2, fuzzy: ['collect evidence'] }],
            ['cyber safety', { action: () => this._app.openCyberSafety(), priority: 3, fuzzy: [] }],
            ['settings', { action: () => this._app.openSettings(), priority: 3, fuzzy: [] }],
            ['vigilia help', { action: () => this.showHelp(), priority: 3, fuzzy: ['help', 'voice help'] }]
        ]);
    }

    /**
     * Builds command callbacks
     * @private
     * @returns {Object} Callbacks for VoiceRecognition
     */
    _buildCommandCallbacks() {
        return {
            onStatus: (msg, type) => this._log(msg, type),
            onError: (msg, details) => {
                this._log(`Error: ${msg}`, 'danger');
                this._performanceMetrics.errorCount++;
                this._log(`Error: ${msg}`, 'error', details);
                if (msg && (msg.includes('network') || msg.includes('connection'))) {
                    this._handleConnectionLoss();
                } else if (msg && (msg.includes('permissions') || msg.includes('microphone'))) {
                    this._log('Microphone access required', 'warning');
                }
            },
            onResult: (transcript, confidence) => this._processCommand(transcript, confidence),
            onWhisperDetected: () => {
                this._performanceMetrics.whisperDetections++;
                this._log('Whisper detected', 'info');
            }
        };
    }

    /**
     * Processes recognized transcript
     * @private
     * @param {string} transcript - Recognized text
     * @param {number} confidence - Confidence score
     */
    _processCommand(transcript, confidence) {
        if (!this._isReady) {
            this._commandQueue.push(() => this._processCommand(transcript, confidence));
            return;
        }
        if (!transcript || confidence < this.config.minConfidence) {
            this._performanceMetrics.misrecognizedCommands.push({ transcript, confidence, timestamp: new Date() });
            if (this._performanceMetrics.misrecognizedCommands.length > 500) {
                this._performanceMetrics.misrecognizedCommands.shift();
            }
            this._log(`Low confidence transcript: ${transcript} (${confidence})`, 'warning');
            return;
        }

        const startTime = performance.now();
        const normalizedTranscript = transcript.toLowerCase().replace(/[^\w\s]/g, '');
        const matches = this._fuse.search(normalizedTranscript);
        if (matches.length > 0 && matches[0].score <= this.config.fuzzyThreshold) {
            const matchedPhrase = matches[0].item;
            const command = this._commandRegistry.get(matchedPhrase);
            if (command) {
                try {
                    this._performanceMetrics.commandsProcessed++;
                    if (command.isCritical) this._performanceMetrics.criticalCommandsProcessed++;
                    this._performanceMetrics.successfulCommands++;
                    this._performanceMetrics.averageConfidence =
                        (this._performanceMetrics.averageConfidence * (this._performanceMetrics.commandsProcessed - 1) + confidence) /
                        this._performanceMetrics.commandsProcessed;
                    command.action();
                    this._log(`Command executed: ${matchedPhrase}`, 'success');
                } catch (error) {
                    this._log(`Command failed: ${error.message}`, 'danger');
                    this._log(`Command error: ${error.message}`, 'error', { error });
                }
            }
        } else {
            this._log(`No command matched: ${transcript}`, 'warning');
        }
        this._performanceMetrics.totalProcessingTime += performance.now() - startTime;
    }

    /**
     * Enhanced setupVoiceRecognition method for EnhancedVoiceRecognitionSystem
     * Combines robust validation, platform detection, error handling, and initialization flow
     * @returns {Promise<boolean>} Initialization success
     */
    async setupVoiceRecognition() {
        this._log('Initializing voice recognition system', 'info');

        // Guard clauses for state checking
        if (this._isReady) {
            this._log('Voice recognition already initialized', 'success');
            return true;
        }
        if (this._isInitializing) {
            this._log('Initialization in progress', 'info');
            return false;
        }

        this._isInitializing = true;
        const startTime = performance.now();

        try {
            // --- Step 1: Validate configuration and permissions ---
            // Dependency check: Fuse.js
            if (typeof Fuse === 'undefined') {
                throw new Error('Fuse.js library is required for fuzzy matching');
            }
            // App instance check
            if (!this._app || typeof this._log !== 'function') {
                throw new Error('Valid appInstance with showStatus method required');
            }
            // Microphone permission check (browser only)
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop());
                    this._log('Microphone permissions validated', 'success');
                } catch (error) {
                    throw new Error(`Microphone access denied: ${error.message}`);
                }
            }
            // Config validation
            if (this.config.fuzzyThreshold < 0 || this.config.fuzzyThreshold > 1) {
                throw new Error('fuzzyThreshold must be between 0 and 1');
            }
            if (this.config.minConfidence < 0 || this.config.minConfidence > 1) {
                throw new Error('minConfidence must be between 0 and 1');
            }

            // --- Step 2: Platform detection ---
            let platform = 'Unknown';
            if (typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
                platform = 'Cordova';
            } else if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
                platform = 'Web';
            }
            if (platform === 'Unknown') {
                throw new Error('No supported speech recognition platform detected');
            }
            this._log(`Detected platform: ${platform}`, 'info');

            // --- Step 3: Setup VoiceRecognition instance ---
            let lang = this._app.language || 'en-US';
            const langMap = {
                en: 'en-US', es: 'es-ES', fr: 'fr-FR', sw: 'sw-KE',
                de: 'de-DE', hi: 'hi-IN', ar: 'ar-SA', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR'
            };
            const shortLang = lang.split('-')[0];
            if (langMap[shortLang]) lang = langMap[shortLang];

            // Optionally update Fuse.js with localized commands
            const localizedCommands = (() => {
                const loc = {
                    'es-ES': ['vigilia socorro', 'capturar foto', 'grabar audio'],
                    'fr-FR': ['vigilia secours', 'capturer photo', 'enregistrer audio'],
                    'sw-KE': ['vigilia msaada', 'piga picha', 'rekodi sauti']
                };
                return loc[lang] || [...this._commandRegistry.keys()];
            })();
            this._fuse = new Fuse(localizedCommands, {
                threshold: this.config.fuzzyThreshold,
                includeScore: true,
                ignoreLocation: true
            });

            const VoiceRecognitionClass = typeof VoiceRecognition !== 'undefined' ? VoiceRecognition : window.VoiceRecognition;
            this._voiceRecognition = new VoiceRecognitionClass({
                ...this.config,
                language: lang,
                platform,
                callbacks: this._buildCommandCallbacks()
            });
            await this._voiceRecognition.setupVoiceRecognition();

            // --- Step 4: Optionally setup audio processing/whisper detection ---
            // (If you want to add custom audio/whisper logic, do it here)

            // --- Step 5: Finalize initialization ---
            this._isReady = true;
            this._isInitializing = false;
            this._initializationTime = new Date();
            this._performanceMetrics.initTime = performance.now() - startTime;
            this._reconnectAttempts = 0;
            this._processCommandQueue();

            // Show help message
            const criticalCommands = [...this._commandRegistry.entries()]
                .filter(([_, config]) => config.isCritical)
                .map(([cmd]) => cmd)
                .slice(0, 2);
            const helpText = criticalCommands.length > 0
                ? `Critical: "${criticalCommands.join('", "')}". Say "vigilia help" for all commands.`
                : 'Say "vigilia help" for available commands.';
            this._log(`Voice commands activated! ${helpText}`, 'success');
            this._log(`Initialization completed in ${this._performanceMetrics.initTime.toFixed(2)}ms`, 'success');

            // --- Step 6: Start health monitoring ---
            if (this._healthMonitorInterval) clearInterval(this._healthMonitorInterval);
            this._healthMonitorInterval = setInterval(() => {
                if (!this._isReady || !this._voiceRecognition) {
                    this._log('Health check failed: System not ready', 'warning');
                    if (this.config.autoRestart) this._attemptAutoRestart();
                }
            }, 30000);

            return true;
        } catch (error) {
            this._isInitializing = false;
            this._isReady = false;
            let userMessage = 'Voice recognition initialization failed';
            let logLevel = 'error';
            if (error.message.includes('permission') || error.message.includes('microphone')) {
                userMessage = 'Microphone access required for voice commands';
                logLevel = 'warning';
            } else if (error.message.includes('not supported') || error.message.includes('not available')) {
                userMessage = 'Voice recognition not supported on this device';
                logLevel = 'warning';
            } else if (error.message.includes('network') || error.message.includes('connection')) {
                userMessage = 'Network connection required for voice recognition';
                logLevel = 'warning';
            }
            this._log(userMessage, logLevel === 'warning' ? 'warning' : 'danger');
            this._log(`Initialization error: ${error.message}`, logLevel, { error, stack: error.stack });
            this._performanceMetrics.errorCount++;
            // Retry logic
            if (this.config.autoRestart && this._reconnectAttempts < this.config.maxReconnectAttempts) {
                const retryDelay = 5000 * Math.pow(2, this._reconnectAttempts);
                setTimeout(() => {
                    this._reconnectAttempts++;
                    this.setupVoiceRecognition();
                }, retryDelay);
            }
            return false;
        }
    }

    /**
     * Processes queued commands
     * @private
     */
    _processCommandQueue() {
        if (this._commandQueue.length > 0) {
            this._commandQueue.forEach(command => {
                try { command(); } catch (error) {
                    this._log(`Queued command error: ${error.message}`, 'error', { error });
                }
            });
            this._commandQueue = [];
        }
    }

    /**
     * Handles connection loss
     * @private
     */
    _handleConnectionLoss() {
        if (this._reconnectAttempts < this.config.maxReconnectAttempts) {
            this._reconnectAttempts++;
            const delay = this.config.retryDelay ? this.config.retryDelay * Math.pow(2, this._reconnectAttempts) : 2000 * Math.pow(2, this._reconnectAttempts);
            this._log(`Connection lost. Reconnecting in ${delay}ms...`, 'warning');
            setTimeout(() => this._attemptReconnection(), delay);
        } else {
            this._log('Reconnection failed after maximum attempts', 'danger');
            this._log('Max reconnection attempts reached', 'error');
        }
    }

    /**
     * Attempts reconnection
     * @private
     */
    async _attemptReconnection() {
        try {
            if (this._voiceRecognition) {
                await this._voiceRecognition.setupVoiceRecognition();
                this._reconnectAttempts = 0;
                this._log('Voice recognition reconnected', 'success');
                this._processCommandQueue();
            }
        } catch (error) {
            this._handleConnectionLoss();
        }
    }

    /**
     * Starts periodic logging
     * @private
     */
    _startPeriodicLogging() {
        setInterval(() => {
            if (this.config.debug) {
                this._log('Performance metrics', 'metric', this.getPerformanceMetrics());
            }
        }, 60000);
    }

    /**
     * Logs messages
     * @private
     * @param {string} message - Log message
     * @param {string} type - Log type
     * @param {Object} [details] - Additional details
     */
    _log(message, type, details = {}) {
        if (!this.config.debug && !['error', 'warning', 'success', 'metric'].includes(type)) return;
        const logEntry = { message, type, timestamp: new Date(), details };
        this._logs.push(logEntry);
        if (this._logs.length > 500) {
            this._logs.shift();
        }
        console.log(`[EnhancedVoiceRecognitionSystem][${type}] ${message}`, details);
    }

    /**
     * Checks if the system is ready
     * @returns {boolean} Ready status
     */
    isSystemReady() {
        return this._isReady;
    }

    /**
     * Returns performance metrics
     * @returns {Object} Metrics
     */
    getPerformanceMetrics() {
        return {
            ...this._performanceMetrics,
            uptime: this._initializationTime ? (new Date() - this._initializationTime) / 1000 : 0,
            reconnectAttempts: this._reconnectAttempts
        };
    }

    /**
     * Returns recent logs
     * @returns {Array} Logs
     */
    getLogs() {
        return [...this._logs];
    }

    /**
     * Displays available commands
     */
    showHelp() {
        const commands = [...this._commandRegistry.entries()].map(([cmd, config]) => ({
            command: cmd,
            priority: config.priority,
            isCritical: config.isCritical,
            alternatives: config.fuzzy
        }));
        const critical = commands.filter(c => c.isCritical).map(c => c.command).join(', ');
        this._log(`Critical commands: ${critical}. See console for all commands.`, 'info');
        console.log('Available Voice Commands:', commands);
    }

    /**
     * Triggers a command manually
     * @param {string} commandName - Command to trigger
     * @returns {Promise<boolean>} Success status
     */
    async triggerCommand(commandName) {
        const command = this._commandRegistry.get(commandName);
        if (command) {
            try {
                this._performanceMetrics.commandsProcessed++;
                if (command.isCritical) this._performanceMetrics.criticalCommandsProcessed++;
                this._performanceMetrics.successfulCommands++;
                await command.action();
                this._log(`Manually triggered command: ${commandName}`, 'success');
                return true;
            } catch (error) {
                this._log(`Failed to trigger command ${commandName}: ${error.message}`, 'danger');
                this._log(`Command error: ${error.message}`, 'error', { error });
                return false;
            }
        }
        return false;
    }

    /**
     * Shuts down the system
     * @returns {Promise<void>}
     */
    async shutdown() {
        this._isReady = false;
        if (this._voiceRecognition) {
            await this._voiceRecognition.stopListening();
            this._voiceRecognition = null;
        }
        this._logs = [];
        this._commandQueue = [];
        this._log('Voice recognition system shut down', 'info');
    }

    /**
     * Starts listening for voice input.
     * @returns {Promise<boolean>} Success status
    */
    async startListening() {
        if (this._voiceRecognition && typeof this._voiceRecognition.startListening === 'function') {
            return await this._voiceRecognition.startListening();
        } else {
            this._log('VoiceRecognition instance not ready or startListening not available', 'error');
            return false;
        }
    }
    
}