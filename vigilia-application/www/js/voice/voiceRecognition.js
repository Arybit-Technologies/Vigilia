/**
 * VoiceRecognition class for web-based speech recognition using Web Speech API.
 * Supports continuous listening, whisper detection, and UI integration.
 * @license Apache License 2.0
 */
class VoiceRecognition {
    constructor(options = {}) {
        this.config = {
            languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'sw-KE', 'hi-IN'],
            defaultLanguage: 'en-US',
            minConfidence: 0.5,
            sensitivity: 0.08,
            whisperSensitivity: 0.03,
            debug: false,
            continuousListening: true,
            interimResults: true,
            enableWhisperDetection: true,
            ...options
        };

        this.ui = options.ui || null;
        this.callbacks = {
            onResult: () => {},
            onStatus: () => {},
            onError: () => {},
            onWhisperDetected: () => {},
            ...options.callbacks
        };

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
            retryCount: 0,
            maxRetries: 5,
            transcript: '',
            _explicitStop: false
        };

        this._logs = [];
        this.initializeUI();
        this._checkWebSpeechApiSupport();
    }

    initializeUI() {
        if (!this.ui && typeof VoiceRecognitionUI !== 'undefined') {
            this.ui = new VoiceRecognitionUI({
                recognition: this,
                callbacks: {
                    onStartListening: () => this.startListening(),
                    onStopListening: () => this.stopListening(),
                    onClearTranscript: () => this.clearTranscript(),
                    onSetLanguage: (lang) => this.setLanguage(lang),
                    onSetContinuousListening: (enabled) => this.setContinuousListening(enabled),
                    onStatus: (msg, type) => this.callbacks.onStatus(msg, type)
                }
            });
            console.log('VoiceRecognitionUI instantiated in VoiceRecognition');
        }
    }

    _log(message, type = 'info', details = null) {
        if (!this.config.debug && type === 'debug') return;
        const timestamp = new Date().toISOString();
        this._logs.push({ timestamp, message, type, details });
        if (this._logs.length > 500) this._logs.shift();
        console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log'](
            `[VoiceRecognition - ${type.toUpperCase()}] ${message}`, details || ''
        );
    }

    _checkWebSpeechApiSupport() {
        if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
            this._log('Web Speech API not supported', 'error', { userAgent: navigator.userAgent });
            if (this.ui) this.ui.showWarning('Speech recognition is not supported in this browser.');
            this.callbacks.onError('Speech recognition is not supported in this browser.');
            return false;
        }
        return true;
    }

    _normalizeLanguage(lang) {
        const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', sw: 'sw-KE', de: 'de-DE', hi: 'hi-IN' };
        return langMap[lang?.split('-')[0]] || lang || this.config.defaultLanguage;
    }

    async setupVoiceRecognition(force = false) {
        if (this.state.isInitialized && !force) {
            if (this.ui) this.ui.updateStatus('success', 'Voice recognition already initialized');
            this.callbacks.onStatus('Voice recognition already initialized', 'success');
            return true;
        }
        if (this.state.isProcessing) {
            if (this.ui) this.ui.updateStatus('info', 'Initialization in progress');
            this.callbacks.onStatus('Initialization in progress', 'info');
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
            if (this.ui) this.ui.updateStatus('success', 'Voice recognition initialized');
            this.callbacks.onStatus('Voice recognition initialized', 'success');

            const voiceRecContainer = document.getElementById('voiceRecognitionScreen');
            if (voiceRecContainer) {
                voiceRecContainer.style.display = 'block';
            }

            return true;
        } catch (error) {
            this.state.isProcessing = false;
            if (this.ui) this.ui.showWarning('Initialization failed: ' + error.message);
            this.callbacks.onError('Initialization failed: ' + error.message);
            this._log('Initialization failed', 'error', { error });
            return false;
        }
    }

    async _checkMicrophonePermissions() {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('getUserMedia not supported in this browser.');
        }
        try {
            this.state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._log('Microphone permissions validated', 'success');
        } catch (error) {
            const errorMsg = `Microphone access denied: ${error.name || error.message}`;
            if (this.ui) this.ui.showWarning(errorMsg);
            this.callbacks.onError(errorMsg);
            this._log(errorMsg, 'error', { error });
            throw new Error(errorMsg);
        }
    }

    _setupRecognitionEvents() {
        if (!this.state.recognition) return;
        this.state.retryCount = 0;

        this.state.recognition.onstart = () => {
            this.state.isListening = true;
            this.state.retryCount = 0;
            if (this.ui) this.ui.updateStatus('listening', '🎙️ Listening...');
            this.callbacks.onStatus('Listening... Speak now', 'listening');
        };

        this.state.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = this.state.transcript;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            const fullTranscript = finalTranscript + interimTranscript;
            const confidence = event.results[event.resultIndex]?.[0]?.confidence || 0;
            this.state.transcript = fullTranscript;
            if (this.ui) this.ui.updateTranscript(fullTranscript, confidence);
            this.callbacks.onResult(fullTranscript, confidence);
        };

        this.state.recognition.onerror = (event) => {
            this._lastRecognitionError = event.error;
            let errorMessage = 'Recognition error: ';
            switch (event.error) {
                case 'no-speech':
                    errorMessage += 'No speech detected.';
                    break;
                case 'audio-capture':
                    errorMessage += 'Audio capture failed.';
                    break;
                case 'not-allowed':
                    errorMessage += 'Microphone access denied.';
                    break;
                default:
                    errorMessage += event.error;
            }
            if (this.ui) this.ui.showWarning(errorMessage);
            this.callbacks.onError(errorMessage);
            this.stopListening();
        };

        this.state.recognition.onend = () => {
            this.state.isListening = false;
            if (this.ui) this.ui.updateStatus('stopped', this.state.transcript ? 'Recognition completed' : 'Click to start recording');
            this.callbacks.onStatus(this.state.transcript ? 'Recognition completed' : 'Click to start recording', 'stopped');
            if (this.config.continuousListening &&
                !['aborted', 'audio-capture', 'not-allowed'].includes(this._lastRecognitionError) &&
                !this._explicitStop &&
                this.state.retryCount < this.state.maxRetries) {
                this.state.retryCount++;
                this._log(`Continuous mode: Restarting (Attempt ${this.state.retryCount}/${this.state.maxRetries})`, 'info');
                setTimeout(() => this.startListening(), 500);
            }
            this._lastRecognitionError = null;
            this._explicitStop = false;
        };
    }

    async _setupAudioProcessing() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext || !this.state.mediaStream || !this.config.enableWhisperDetection) {
            this._log('Audio processing skipped', 'warning');
            return;
        }
        try {
            this.state.audioContext = new AudioContext();
            if (this.state.audioContext.state === 'suspended') {
                await this.state.audioContext.resume();
            }
            const source = this.state.audioContext.createMediaStreamSource(this.state.mediaStream);
            const analyser = this.state.audioContext.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            this.state.audioAnalyser = analyser;
            this._startWhisperDetection(analyser);
        } catch (error) {
            this._log('Failed to set up audio processing', 'warning', { error });
        }
    }

    _startWhisperDetection(analyser) {
        if (!this.config.enableWhisperDetection) return;
        const dataArray = new Uint8Array(analyser.fftSize);
        let lastCheck = 0;
        const checkInterval = 100;
        const detectWhisper = (currentTime) => {
            if (currentTime - lastCheck < checkInterval || !this.state.isListening) {
                requestAnimationFrame(detectWhisper);
                return;
            }
            lastCheck = currentTime;
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const value = (dataArray[i] / 128) - 1;
                sum += value * value;
            }
            const volume = Math.sqrt(sum / dataArray.length);
            if (volume >= this.config.whisperSensitivity && volume < this.config.sensitivity) {
                this.state.whisperDetections++;
                if (this.ui) this.ui.updateStatus('listening', '🔊 Whisper detected');
                this.callbacks.onWhisperDetected();
                this._log(`Whisper detected (Volume: ${volume.toFixed(3)})`, 'info');
            }
            requestAnimationFrame(detectWhisper);
        };
        requestAnimationFrame(detectWhisper);
    }

    async startListening() {
        if (!this.state.isInitialized) {
            const initialized = await this.setupVoiceRecognition();
            if (!initialized) return;
        }
        if (this.state.isListening) return;
        try {
            this.state.recognition.start();
        } catch (error) {
            if (this.ui) this.ui.showWarning(`Error starting recognition: ${error.message}`);
            this.callbacks.onError(`Error starting recognition: ${error.message}`);
            this.state.isListening = false;
        }
    }

    stopListening() {
        if (this.state.recognition && this.state.isListening) {
            this._explicitStop = true;
            this.state.recognition.stop();
            this.state.isListening = false;
        }
    }

    clearTranscript() {
        this.state.transcript = '';
        if (this.ui) this.ui.updateTranscript('', 0);
        this.callbacks.onResult('', 0);
    }

    setLanguage(lang) {
        this.config.defaultLanguage = this._normalizeLanguage(lang);
        if (this.state.recognition) {
            this.state.recognition.lang = this.config.defaultLanguage;
            if (this.state.isListening) {
                this.stopListening();
                this.startListening();
            }
        }
        if (this.ui) this.ui.updateStatus('info', `Language set to ${this.config.defaultLanguage}`);
        this.callbacks.onStatus(`Language set to ${this.config.defaultLanguage}`, 'info');
    }

    setContinuousListening(enabled) {
        this.config.continuousListening = !!enabled;
        if (this.state.recognition) {
            this.state.recognition.continuous = this.config.continuousListening;
            if (this.state.isListening) {
                this.stopListening();
                this.startListening();
            }
        }
        if (this.ui) this.ui.updateStatus('info', `Continuous listening ${enabled ? 'enabled' : 'disabled'}`);
        this.callbacks.onStatus(`Continuous listening ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
}