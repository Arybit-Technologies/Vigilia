/**
 * Voice command configuration schema with validation
 */
const VOICE_COMMAND_CONFIG = {
  languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'sw-KE', 'hi-IN'], // Added more languages
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
 * Combines the best features from both versions with additional safety features
 */
class VoiceRecognition {
  constructor() {
    this._voiceRecognition = null;
    this._initializationTime = null;
    this._isReady = false;
    this._isInitializing = false;
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
   * Enhanced command registry with VigiliaApp-specific commands
   */
  get _commandRegistry() {
    return {
      // Critical safety commands
      'SOS': { 
        handler: () => this.startVoiceSOS(), 
        isCritical: true,
        alternatives: ['emergency', 'help me', 'mayday'],
        priority: 1
      },
      'emergency': { 
        handler: () => this.startVoiceSOS(), 
        isCritical: true,
        priority: 1
      },
      
      // Media capture commands
      'capture photo': { 
        handler: () => this.capturePhoto(), 
        isCritical: false,
        alternatives: ['take photo', 'snap picture'],
        priority: 3
      },
      'record audio': { 
        handler: () => this.recordAudio(), 
        isCritical: false,
        alternatives: ['start recording'],
        priority: 3
      },
      'record video': { 
        handler: () => this.startVideoRecording(), 
        isCritical: false,
        alternatives: ['start video'],
        priority: 3
      },
      
      // Navigation and location
      'share location': { 
        handler: () => this.shareLocation(), 
        isCritical: false,
        priority: 2
      },
      'safe route': { 
        handler: () => this.openSafeRoute(), 
        isCritical: false,
        alternatives: ['find safe path', 'navigation'],
        priority: 2
      },
      'refresh location': { 
        handler: () => this.updateLocationDetails(), 
        isCritical: false,
        priority: 3
      },
      
      // Safety features
      'threat detection': { 
        handler: () => this.startThreatDetection(), 
        isCritical: true,
        priority: 2
      },
      'safe journey': { 
        handler: () => this.openSafeJourney(), 
        isCritical: false,
        priority: 2
      },
      
      // Communication
      'open contacts': { 
        handler: () => this.openContacts(), 
        isCritical: false,
        priority: 3
      },
      'encrypted chat': { 
        handler: () => this.openEncryptedChat(), 
        isCritical: false,
        alternatives: ['secure chat'],
        priority: 2
      },
      
      // Support services
      'mental health': { 
        handler: () => this.openMentalHealth(), 
        isCritical: false,
        alternatives: ['counseling', 'support'],
        priority: 2
      },
      'legal aid': { 
        handler: () => this.openLegalAid(), 
        isCritical: false,
        alternatives: ['legal help'],
        priority: 2
      },
      'evidence': { 
        handler: () => this.openEvidence(), 
        isCritical: false,
        alternatives: ['collect evidence'],
        priority: 2
      },
      
      // Security
      'cyber safety': { 
        handler: () => this.openCyberSafety(), 
        isCritical: false,
        priority: 3
      },
      
      // System
      'settings': { 
        handler: () => this.openSettings(), 
        isCritical: false,
        priority: 3
      },
      'help': { 
        handler: () => this.showVoiceHelp(), 
        isCritical: false,
        alternatives: ['vigilia help', 'voice help'],
        priority: 3
      }
    };
  }

  /**
   * Enhanced initialization with better error handling and fallbacks
   */
  async setupVoiceRecognition() {
    if (this._isReady) {
      console.log('VoiceRecognition system is already initialized.');
      console.log('[SUCCESS] Voice commands ready!');
      return true;
    }

    if (this._isInitializing) {
      console.log('VoiceRecognition initialization already in progress.');
      return false;
    }

    this._isInitializing = true;
    const startTime = performance.now();
    
    try {
      const config = {
        language: this.language || VOICE_COMMAND_CONFIG.defaultLanguage,
        maxRetries: 5,
        retryDelay: 2000,
        confidenceThreshold: 0.7,
        debug: true,
        autoRestart: true,
        adaptiveSensitivity: true,
        backgroundMode: false,
        offlineMode: await this._checkOfflineCapability(),
        continuousListening: true,
        interimResults: true
      };

      this._validateConfig(config);

      // Initialize primary system
      await this._initializePrimarySystem(config);
      
      // Initialize fallback systems
      await this._initializeFallbackSystems(config);

      this._isReady = true;
      this._isInitializing = false;
      this._initializationTime = new Date();
      this._performanceMetrics.initTime = performance.now() - startTime;

      console.log('VoiceRecognition successfully initialized in', 
        this._performanceMetrics.initTime.toFixed(2), 'ms');
      console.log('[SUCCESS] Voice commands activated! Say "Vigilia help" for options.');
      
      // Process any queued commands
      this._processCommandQueue();
      
      return true;
    } catch (error) {
      this._isInitializing = false;
      console.error('VoiceRecognition initialization failed:', error);
      console.warn('[WARNING] Voice system error - Attempting fallback...');
      
      // Attempt fallback activation
      const fallbackSuccess = await this._activateFallbackSystem();
      if (!fallbackSuccess) {
        console.error('[ERROR] ❌ Voice commands unavailable');
        return false;
      }
      
      return true;
    }
  }

  /**
   * Initializes the primary voice recognition system with enhanced callbacks
   */
  async _initializePrimarySystem(config) {
    this._voiceRecognition = new VoiceRecognition({
      ...config,
      callbacks: {
        ...this._buildCommandCallbacks(),
        onStatus: (msg, type) => this._handleStatusUpdate(msg, type),
        onError: (error) => this._handleRecognitionError(error),
        onBufferedSpeechProcessed: (audioBuffer) => 
          this._processAudioBuffer(audioBuffer),
        onRecognitionResult: (result) => 
          this._trackRecognitionAccuracy(result),
        onConnectionLost: () => this._handleConnectionLoss(),
        onReconnected: () => this._handleReconnection()
      }
    });

    console.log('VoiceRecognition instance created. Setting up...');
    console.log('[INFO] Activating voice commands...');
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
          if (config.isCritical) {
            this._performanceMetrics.criticalCommandsProcessed++;
          }
          await config.handler(...args);
        } catch (error) {
          console.error(`Error executing command ${command}:`, error);
          console.error(`[ERROR] Command failed: ${command}`);
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
    const timestamp = new Date().toISOString();
    const logLevel = type === 'error' ? 'error' : 'log';
    
    console[logLevel](`[VR][${timestamp}] ${type?.toUpperCase() || 'INFO'}: ${msg}`);
    
    // Only show status for important messages or debug mode
    if (this._voiceRecognition?.config?.debug || ['error', 'warning', 'success'].includes(type)) {
      console.log(`[${type?.toUpperCase() || 'INFO'}] ${msg}`);
    }

    // Update performance metrics
    if (type === 'success') {
      this._updateSuccessRate();
    }
  }

  /**
   * Enhanced error handling with automatic recovery
   */
  _handleRecognitionError(error) {
    console.error('VoiceRecognition Error:', error);
    
    // Categorize errors and handle appropriately
    if (error.includes('network') || error.includes('connection')) {
      this._handleConnectionLoss();
    } else if (error.includes('permissions') || error.includes('microphone')) {
      console.warn('[WARNING] Microphone access required for voice commands');
    } else {
      console.error(`[ERROR] Voice system error: ${error}`);
      
      // Attempt restart for critical errors
      if (this._shouldAttemptRestart(error)) {
        this._scheduleRestart();
      }
    }
  }

  /**
   * Handles connection loss with automatic reconnection
   */
  _handleConnectionLoss() {
    console.warn('Voice recognition connection lost');
    console.warn('[WARNING] Voice connection lost - attempting to reconnect...');
    
    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++;
      setTimeout(() => this._attemptReconnection(), 2000 * this._reconnectAttempts);
    } else {
      console.error('[ERROR] Voice reconnection failed - using fallback system');
      this._activateFallbackSystem();
    }
  }

  /**
   * Attempts to reconnect the voice system
   */
  async _attemptReconnection() {
    try {
      if (this._voiceRecognition) {
        await this._voiceRecognition.restart();
        this._handleReconnection();
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      this._handleConnectionLoss(); // Try again or fail over
    }
  }

  /**
   * Handles successful reconnection
   */
  _handleReconnection() {
    console.log('Voice recognition reconnected successfully');
    console.log('[SUCCESS] Voice commands restored');
    this._reconnectAttempts = 0;
    this._processCommandQueue();
  }

  /**
   * Processes queued commands after reconnection
   */
  _processCommandQueue() {
    if (this._commandQueue.length > 0) {
      console.log(`Processing ${this._commandQueue.length} queued commands`);
      const commands = [...this._commandQueue];
      this._commandQueue = [];
      
      commands.forEach(command => {
        try {
          command();
        } catch (error) {
          console.error('Error processing queued command:', error);
        }
      });
    }
  }

  /**
   * Enhanced offline capability check
   */
  async _checkOfflineCapability() {
    try {
      if (typeof OfflineVoiceRecognition === 'undefined') return false;
      if (!navigator.storage) return false;
      
      const estimate = await navigator.storage.estimate();
      return estimate.quota > 50000000; // 50MB minimum
    } catch (error) {
      console.warn('Could not check offline capability:', error);
      return false;
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
    const criticalCommands = commands.filter(cmd => 
      this._commandRegistry[cmd].isCritical);
    
    console.log('Available Voice Commands:');
    console.log('Critical Commands:', criticalCommands.join(', '));
    console.log('All Commands:', commands.join(', '));
    
    console.log(`[INFO] Voice help: Say "${criticalCommands[0]}" for emergency, or check console for all commands`);
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
    console.log('Scheduling voice system restart...');
    setTimeout(async () => {
      this._isReady = false;
      this._voiceRecognition = null;
      await this.setupVoiceRecognition();
    }, 5000);
  }

  // Public API methods
  
  /**
   * Checks if the system is ready
   */
  isSystemReady() {
    return this._isReady;
  }

  /**
   * Gets comprehensive performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this._performanceMetrics,
      uptime: this._initializationTime ? 
        (new Date() - this._initializationTime) / 1000 : 0,
      reconnectAttempts: this._reconnectAttempts,
      hasFallbacks: this._fallbackSystems.length > 0
    };
  }

  /**
   * Gets available commands categorized by priority
   */
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

  /**
   * Manually triggers a command (useful for testing)
   */
  async triggerCommand(commandName) {
    const command = this._commandRegistry[commandName];
    if (command) {
      try {
        await command.handler();
        return true;
      } catch (error) {
        console.error(`Failed to trigger command ${commandName}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Gracefully shuts down the voice system
   */
  async shutdown() {
    console.log('Shutting down voice recognition system...');
    this._isReady = false;
    
    if (this._voiceRecognition) {
      try {
        await this._voiceRecognition.stop();
      } catch (error) {
        console.warn('Error during voice recognition shutdown:', error);
      }
    }
    
    this._fallbackSystems.forEach(system => {
      try {
        system.shutdown?.();
      } catch (error) {
        console.warn('Error shutting down fallback system:', error);
      }
    });
    
    console.log('[INFO] Voice commands deactivated');
  }
}