/**
 * VoiceRecognition class for the Vigilia safety app.
 * Provides cross-platform voice command recognition with support for Web Speech API and Cordova environments.
 * Features include whisper detection, adaptive sensitivity, continuous listening, background mode, file rotation,
 * and fuzzy command matching.
 * @license Apache License 2.0
 */
class VoiceRecognition {
 /**
 * Constructor for VoiceRecognition
 * @param {Object} options - Configuration options
 */
 constructor(options = {}) {
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
 fuzzyThreshold: 0.4,
 debug: false,
 continuousListening: true,
 interimResults: true,
 backgroundMode: false,
 fileRotationInterval: 30000, // 30 seconds
 audioChunkDuration: 500, // 500ms chunks
 audioChunkOverlap: 100, // 100ms overlap
 apiKey: process.env.SPEECH_API_KEY || null, // Environment variable for security
 batteryThreshold: 0.2, // Pause non-critical tasks below 20% battery
 ...options
 };

 // Command triggers with actions, priorities, and fuzzy variants
 this.triggers = new Map([
 ['vigilia sos', { action: 'onSOS', priority: 1, fuzzy: ['sos', 'emergency', 'help me', 'mayday'], isCritical: true }],
 ['capture photo', { action: 'onCapturePhoto', priority: 3, fuzzy: ['take photo', 'snap picture'] }],
 ['record audio', { action: 'onRecordAudio', priority: 3, fuzzy: ['start recording'] }],
 ['record video', { action: 'onRecordVideo', priority: 3, fuzzy: ['start video'] }],
 ['share location', { action: 'onShareLocation', priority: 2, fuzzy: [] }],
 ['safe route', { action: 'onSafeRoute', priority: 2, fuzzy: ['find safe path', 'navigation'] }],
 ['refresh location', { action: 'onRefreshLocation', priority: 3, fuzzy: [] }],
 ['threat detection', { action: 'onThreatDetection', priority: 2, fuzzy: [], isCritical: true }],
 ['safe journey', { action: 'onSafeJourney', priority: 2, fuzzy: [] }],
 ['open contacts', { action: 'onOpenContacts', priority: 3, fuzzy: [] }],
 ['encrypted chat', { action: 'onEncryptedChat', priority: 2, fuzzy: ['secure chat'] }],
 ['mental health', { action: 'onMentalHealth', priority: 2, fuzzy: ['counseling', 'support'] }],
 ['legal aid', { action: 'onLegalAid', priority: 2, fuzzy: ['legal help'] }],
 ['evidence', { action: 'onEvidence', priority: 2, fuzzy: ['collect evidence'] }],
 ['cyber safety', { action: 'onCyberSafety', priority: 3, fuzzy: [] }],
 ['settings', { action: 'onSettings', priority: 3, fuzzy: [] }],
 ['vigilia help', { action: 'onHelp', priority: 3, fuzzy: ['help', 'voice help'] }],
 ...(options.triggers || [])
 ]);

 // Callbacks for app integration
 this.callbacks = {
 onStatus: (msg, type) => console.log(`[${type}] ${msg}`),
 onError: (msg, details) => console.error(`Error: ${msg}`, details),
 onSOS: () => console.log('SOS triggered'),
 onCapturePhoto: () => console.log('Photo captured'),
 onRecordAudio: () => console.log('Audio recording started'),
 onRecordVideo: () => console.log('Video recording started'),
 onShareLocation: () => console.log('Location shared'),
 onSafeRoute: () => console.log('Safe route opened'),
 onRefreshLocation: () => console.log('Location refreshed'),
 onThreatDetection: () => console.log('Threat detection started'),
 onSafeJourney: () => console.log('Safe journey opened'),
 onOpenContacts: () => console.log('Contacts opened'),
 onEncryptedChat: () => console.log('Encrypted chat opened'),
 onMentalHealth: () => console.log('Mental health support opened'),
 onLegalAid: () => console.log('Legal aid opened'),
 onEvidence: () => console.log('Evidence collection opened'),
 onCyberSafety: () => console.log('Cyber safety opened'),
 onSettings: () => console.log('Settings opened'),
 onHelp: () => this.showHelp(),
 onWhisperDetected: () => console.log('Whisper detected'),
 ...options.callbacks
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
 commandsProcessed: 0,
 successfulCommands: 0,
 criticalCommandsProcessed: 0,
 errorCount: 0,
 whisperDetections: 0,
 totalProcessingTime: 0,
 averageConfidence: 0,
 logs: [],
 misrecognizedCommands: [],
 retryCount: 0,
 voiceDetectionEnabled: true,
 initTime: 0,
 uptime: 0
 };

 // Initialize Fuse.js for fuzzy matching
 if (typeof Fuse === 'undefined') {
 throw new Error('Fuse.js library is required for fuzzy matching');
 }
 this.fuse = new Fuse([...this.triggers.keys()], {
 threshold: this.config.fuzzyThreshold,
 includeScore: true,
 ignoreLocation: true
 });

 // Bind methods
 this.startListening = this.startListening.bind(this);
 this.stopListening = this.stopListening.bind(this);
 this._handleError = this._handleError.bind(this);
 this._detectPlatform();
 this._initElements();
 this._startPeriodicLogging();
 }

 /**
 * Detects the runtime platform (Web or Cordova)
 * @private
 */
 _detectPlatform() {
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
 * Initializes DOM elements for UI control
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

 // Populate language select
 if (this.elements.languageSelect) {
 this.elements.languageSelect.innerHTML = this.config.languages.map(lang =>
 `<option value="${lang}" ${lang === this.config.defaultLanguage ? 'selected' : ''}>
 ${lang}
 </option>`
 ).join('');
 this.elements.languageSelect.onchange = (e) => this.setLanguage(e.target.value);
 this.elements.languageSelect.setAttribute('aria-label', 'Select language for voice recognition');
 }

 // Bind UI events with accessibility
 if (this.elements.micButton) {
 this.elements.micButton.onclick = () => this.setupVoiceRecognition();
 this.elements.micButton.setAttribute('aria-label', 'Start voice recognition');
 }
 if (this.elements.stopButton) {
 this.elements.stopButton.onclick = () => this.stopListening();
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
 this.elements.continuousSelect.onchange = (e) => this.setContinuousListening(e.target.value === 'true');
 this.elements.continuousSelect.setAttribute('aria-label', 'Toggle continuous listening');
 }
 }

 /**
 * Normalizes language code (e.g., 'en' -> 'en-US')
 * @private
 * @param {string} lang - Language code
 * @returns {string} Normalized language code
 */
 _normalizeLanguage(lang) {
 const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', sw: 'sw-KE', de: 'de-DE', hi: 'hi-IN' };
 return langMap[lang] || lang || this.config.defaultLanguage;
 }

 /**
 * Sets the recognition language
 * @param {string} lang - Language code
 */
 setLanguage(lang) {
 this.config.language = this._normalizeLanguage(lang);
 if (this.elements.languageSelect) {
 this.elements.languageSelect.value = this.config.language;
 }
 if (this.state.recognition) {
 this.state.recognition.lang = this.config.language;
 }
 this._emitStatus(`Language set to ${this.config.language}`, 'info');
 }

 /**
 * Sets continuous listening mode
 * @param {boolean} enabled - Enable or disable continuous listening
 */
 setContinuousListening(enabled) {
 this.config.continuousListening = !!enabled;
 if (this.state.recognition) {
 this.state.recognition.continuous = !!enabled;
 }
 this._emitStatus(`Continuous listening ${enabled ? 'enabled' : 'disabled'}`, 'info');
 }

 /**
 * Sets sensitivity for audio detection
 * @param {number} value - Sensitivity value (0 to 1)
 */
 setSensitivity(value) {
 if (value < 0 || value > 1) {
 throw new Error('Sensitivity must be between 0 and 1');
 }
 this.config.sensitivity = value;
 this._log(`Sensitivity set to ${value}`, 'info');
 }

 /**
 * Sets fuzzy matching threshold
 * @param {number} value - Fuzzy threshold (0 to 1)
 */
 setFuzzyThreshold(value) {
 if (value < 0 || value > 1) {
 throw new Error('Fuzzy threshold must be between 0 and 1');
 }
 this.config.fuzzyThreshold = value;
 this.fuse.setCollection([...this.triggers.keys()], { threshold: value });
 this._log(`Fuzzy threshold set to ${value}`, 'info');
 }

 /**
 * Adds a new command trigger
 * @param {string} phrase - Command phrase
 * @param {Object} config - Trigger configuration { action, priority, fuzzy, isCritical }
 */
 addTrigger(phrase, { action, priority = 3, fuzzy = [], isCritical = false }) {
 this.triggers.set(phrase, { action, priority, fuzzy, isCritical });
 this.fuse.setCollection([...this.triggers.keys()]);
 this._log(`Added trigger: ${phrase}`, 'info');
 }

 /**
 * Removes a command trigger
 * @param {string} phrase - Command phrase to remove
 */
 removeTrigger(phrase) {
 this.triggers.delete(phrase);
 this.fuse.setCollection([...this.triggers.keys()]);
 this._log(`Removed trigger: ${phrase}`, 'info');
 }

 /**
 * Sets up the voice recognition system
 * @returns {Promise<boolean>} Initialization success
 */
 async setupVoiceRecognition() {
 if (this.state.isInitialized) {
 this._emitStatus('Voice recognition already initialized', 'success');
 return true;
 }
 if (this.state.isProcessing) {
 this._emitStatus('Initialization in progress', 'info');
 return false;
 }
 this.state.isProcessing = true;
 const startTime = performance.now();

 try {
 await this._validateConfig();
 if (this.state.platform === 'Web') {
 await this._setupWebRecognition();
 } else {
 await this._setupCordovaRecognition();
 }
 await this._setupAudioProcessing();
 this.state.isInitialized = true;
 this.state.isProcessing = false;
 this.state.initTime = performance.now() - startTime;
 this.state.initializationTime = new Date();
 this._emitStatus('Voice recognition initialized. Say "vigilia help" for commands.', 'success');
 return true;
 } catch (error) {
 this.state.isProcessing = false;
 this._handleError(error.message, { error });
 return false;
 }
 }

 /**
 * Validates configuration
 * @private
 * @throws {Error} If validation fails
 */
 async _validateConfig() {
 const errors = [];
 if (!this.config.languages.includes(this.config.language || this.config.defaultLanguage)) {
 errors.push(`Unsupported language: ${this.config.language || this.config.defaultLanguage}`);
 }
 if (this.config.minConfidence < 0 || this.config.maxConfidence > 1 ||
 this.config.minConfidence > this.config.maxConfidence) {
 errors.push(`Invalid confidence range: ${this.config.minConfidence}-${this.config.maxConfidence}`);
 }
 if (this.config.maxRetries < 0) {
 errors.push(`Max retries cannot be negative: ${this.config.maxRetries}`);
 }
 if (this.state.platform === 'Cordova' && !this.config.apiKey) {
 errors.push('API key required for Cordova speech-to-text');
 }
 if (errors.length > 0) {
 throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
 }
 }

 /**
 * Sets up Web Speech API recognition
 * @private
 */
 async _setupWebRecognition() {
 const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
 if (!SpeechRecognition) {
 if (this.elements.supportWarning) this.elements.supportWarning.style.display = '';
 throw new Error('Web Speech API not supported');
 }
 if (this.elements.supportWarning) this.elements.supportWarning.style.display = 'none';

 this.state.recognition = new SpeechRecognition();
 this.state.recognition.lang = this.config.language || this.config.defaultLanguage;
 this.state.recognition.continuous = this.config.continuousListening;
 this.state.recognition.interimResults = this.config.interimResults;

 this.state.recognition.onresult = (event) => this._handleWebResult(event);
 this.state.recognition.onerror = (event) => this._handleError(event.error, { event });
 this.state.recognition.onstart = () => {
 this.state.isListening = true;
 this._emitStatus('Voice recognition started', 'info');
 };
 this.state.recognition.onend = () => {
 this.state.isListening = false;
 this._emitStatus('Voice recognition stopped', 'warning');
 if (this.config.continuousListening && this.state.voiceDetectionEnabled) {
 this._restartRecognition();
 }
 };
 }

 /**
 * Sets up Cordova speech recognition
 * @private
 */
 async _setupCordovaRecognition() {
 if (!cordova.plugins?.speechRecognition) {
 throw new Error('Cordova speech recognition plugin not found');
 }
 await new Promise((resolve, reject) => {
 cordova.plugins.speechRecognition.isRecognitionAvailable(
 (available) => available ? resolve() : reject(new Error('Speech recognition not available')),
 reject
 );
 });
 await this._initializeBackgroundMode();
 await this._setupCordovaAudioRecording();
 }

 /**
 * Initializes background mode for Cordova
 * @private
 */
 async _initializeBackgroundMode() {
 if (this.config.backgroundMode && cordova.plugins?.backgroundMode) {
 cordova.plugins.backgroundMode.setDefaults({
 title: 'Vigilia Voice Recognition',
 text: 'Listening for voice commands...',
 silent: false
 });
 cordova.plugins.backgroundMode.enable();
 this._log('Background mode enabled', 'info');
 window.addEventListener('batterystatus', (status) => {
 if (status.level < this.config.batteryThreshold) {
 this.state.voiceDetectionEnabled = false;
 this._log('Voice detection paused due to low battery', 'warning');
 } else {
 this.state.voiceDetectionEnabled = true;
 }
 });
 }
 }

 /**
 * Sets up audio processing for whisper detection 
 * @private
 */
 async _setupAudioProcessing() {
 if (!window.AudioContext && !window.webkitAudioContext) {
 this._log('Web Audio API not supported, whisper detection disabled', 'warning');
 return;
 }
 try {
 const AudioContext = window.AudioContext || window.webkitAudioContext;
 this.state.audioContext = new AudioContext();
 this.state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
 const source = this.state.audioContext.createMediaStreamSource(this.state.mediaStream);
 const analyser = this.state.audioContext.createAnalyser();
 analyser.fftSize = 512;
 source.connect(analyser);
 this._startWhisperDetection(analyser);
 } catch (error) {
 this._log('Failed to setup audio processing', 'error', { error });
 }
 }

 /**
 * Starts whisper detection using Web Audio API
 * @private
 * @param {AnalyserNode} analyser - Audio analyser node
 */
 _startWhisperDetection(analyser) {
 const dataArray = new Uint8Array(analyser.fftSize);
 const detectWhisper = () => {
 if (!this.state.isListening || !this.state.voiceDetectionEnabled) {
 setTimeout(detectWhisper, 100);
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
 setTimeout(detectWhisper, 100);
 };
 detectWhisper();
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
 gainNode.gain.value = 1.5; // Boost for whispers
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
 setInterval(() => this._rotateAudioFile(), this.config.fileRotationInterval);
 }

 /**
 * Rotates audio file in Cordova to manage size
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
 setInterval(async () => {
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
 this.state.audioBuffer = [];
 // Placeholder for Cordova audio recording (requires cordova-plugin-media)
 this._log('Started audio buffering', 'info');
 }

 /**
 * Processes audio chunk in Cordova
 * @private
 * @param {Float32Array} chunk - Audio chunk to process
 */
 async _processAudioChunk(chunk) {
 try {
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 3000);
 const wavBlob = this._float32ArrayToWavBlob(chunk);
 const response = await fetch('https://api.example.com/speech-to-text', {
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
 this._processTranscript(transcript, confidence);
 } catch (error) {
 clearTimeout(timeoutId);
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
 // Placeholder for WAV conversion (implement actual conversion logic)
 return new Blob([audioData], { type: 'audio/wav' });
 }

 /**
 * Handles Web Speech API results
 * @private
 * @param {SpeechRecognitionEvent} event - Recognition event
 */
 _handleWebResult(event) {
 const transcript = Array.from(event.results)
 .map(result => result[0].transcript)
 .join(' ')
 .trim();
 const confidence = event.results[0][0].confidence;
 this._processTranscript(transcript, confidence);
 }

 /**
 * Processes recognized transcript
 * @private
 * @param {string} transcript - Recognized text
 * @param {number} confidence - Confidence score
 */
 _processTranscript(transcript, confidence) {
 if (!transcript || confidence < this.config.minConfidence) {
 this.state.misrecognizedCommands.push({ transcript, confidence, timestamp: new Date() });
 if (this.state.misrecognizedCommands.length > 500) {
 this.state.misrecognizedCommands.shift();
 }
 this._log(`Low confidence transcript: ${transcript} (${confidence})`, 'warning');
 return;
 }

 this.state.transcript = transcript;
 if (this.elements.transcript) {
 this.elements.transcript.textContent = transcript;
 }
 this._log(`Transcript: ${transcript} (Confidence: ${confidence})`, 'transcript');

 const startTime = performance.now();
 const normalizedTranscript = transcript.toLowerCase().replace(/[^\w\s]/g, '');
 const matches = this.fuse.search(normalizedTranscript);
 if (matches.length > 0 && matches[0].score <= this.config.fuzzyThreshold) {
 const matchedPhrase = matches[0].item;
 const trigger = this.triggers.get(matchedPhrase);
 if (trigger && this.callbacks[trigger.action]) {
 this.state.commandsProcessed++;
 if (trigger.isCritical) this.state.criticalCommandsProcessed++;
 this.state.successfulCommands++;
 this.state.averageConfidence = (this.state.averageConfidence * (this.state.commandsProcessed - 1) + confidence) / this.state.commandsProcessed;
 this.state.totalProcessingTime += performance.now() - startTime;
 this.callbacks[trigger.action](transcript, confidence);
 this._log(`Command executed: ${matchedPhrase}`, 'success');
 }
 } else {
 this.state.misrecognizedCommands.push({ transcript, confidence, timestamp: new Date() });
 if (this.state.misrecognizedCommands.length > 500) {
 this.state.misrecognizedCommands.shift();
 }
 }
 }

 /**
 * Handles errors with recovery logic
 * @private
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 */
 _handleError(message, details = {}) {
 this.state.errorCount++;
 this._emitStatus(`Error: ${message}`, 'danger');
 this.callbacks.onError(message, details);
 if (message.includes('network') || message.includes('connection')) {
 this._handleConnectionLoss();
 } else if (message.includes('permissions') || message.includes('microphone')) {
 this._emitStatus('Microphone access required for voice commands', 'warning');
 } else if (this._shouldAttemptRestart(message)) {
 this._scheduleRestart();
 }
 }

 /**
 * Handles connection loss with reconnection logic
 * @private
 */
 _handleConnectionLoss() {
 if (this.state.retryCount < this.config.maxRetries) {
 this.state.retryCount++;
 const delay = this.config.retryDelay * Math.pow(2, this.state.retryCount); // Exponential backoff
 this._emitStatus(`Connection lost. Reconnecting in ${delay}ms...`, 'warning');
 setTimeout(() => this._restartRecognition(), delay);
 } else {
 this._emitStatus('Reconnection failed after maximum attempts', 'danger');
 }
 }

 /**
 * Determines if system should attempt restart
 * @private
 * @param {string} error - Error message
 * @returns {boolean} Whether to restart
 */
 _shouldAttemptRestart(error) {
 const restartableErrors = ['timeout', 'initialization', 'setup', 'no-speech'];
 return restartableErrors.some(err => error.toLowerCase().includes(err));
 }

 /**
 * Schedules a system restart
 * @private
 */
 _scheduleRestart() {
 this._emitStatus('Scheduling voice system restart...', 'warning');
 setTimeout(async () => {
 this.state.isInitialized = false;
 await this.stopListening();
 await this.setupVoiceRecognition();
 if (this.state.isInitialized) {
 this.startListening();
 }
 }, 5000);
 }

 /**
 * Restarts recognition
 * @private
 */
 async _restartRecognition() {
 try {
 if (this.state.recognition && this.state.platform === 'Web') {
 this.state.recognition.start();
 } else if (this.state.platform === 'Cordova') {
 await this._setupCordovaAudioRecording();
 }
 this.state.retryCount = 0;
 this._emitStatus('Voice recognition reconnected', 'success');
 } catch (error) {
 this._handleError('Reconnection failed', { error });
 }
 }

 /**
 * Starts periodic logging of metrics
 * @private
 */
 _startPeriodicLogging() {
 setInterval(() => {
 if (this.config.debug) {
 this._log('Performance metrics', 'metric', this.getMetrics());
 }
 }, 60000);
 }

 /**
 * Logs messages with type and details
 * @private
 * @param {string} message - Log message
 * @param {string} type - Log type (info, warning, error, transcript, success, metric)
 * @param {Object} [details] - Additional details
 */
 _log(message, type, details = {}) {
 if (!this.config.debug && !['error', 'warning', 'transcript', 'success', 'metric'].includes(type)) return;
 const logEntry = { message, type, timestamp: new Date(), details };
 this.state.logs.push(logEntry);
 if (this.state.logs.length > 500) {
 this.state.logs.shift();
 }
 if (this.config.debug) {
 console.log(`[VoiceRecognition][${type}] ${message}`, details);
 }
 }

 /**
 * Emits status messages
 * @private
 * @param {string} message - Status message
 * @param {string} type - Status type (success, info, warning, danger)
 */
 _emitStatus(message, type = 'info') {
 this.callbacks.onStatus(message, type);
 if (this.elements.status) {
 this.elements.status.textContent = message;
 this.elements.status.className = `alert alert-${type}`;
 this.elements.status.setAttribute('aria-live', 'polite');
 }
 }

 /**
 * Starts listening for voice commands
 * @returns {Promise<boolean>} Success status
 */
 async startListening() {
 if (!this.state.isInitialized) {
 await this.setupVoiceRecognition();
 }
 if (this.state.isListening) {
 this._emitStatus('Already listening', 'info');
 return false;
 }
 try {
 if (this.state.platform === 'Web') {
 this.state.recognition.start();
 } else {
 await this._startContinuousAudioProcessing();
 }
 return true;
 } catch (error) {
 this._handleError('Failed to start listening', { error });
 return false;
 }
 }

 /**
 * Stops listening for voice commands
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
 }
 if (this.state.mediaStream) {
 this.state.mediaStream.getTracks().forEach(track => track.stop());
 }
 if (this.state.audioContext) {
 await this.state.audioContext.close();
 }
 this.state.isListening = false;
 this.state.audioBuffer = [];
 this._emitStatus('Voice recognition stopped', 'info');
 } catch (error) {
 this._handleError('Failed to stop listening', { error });
 }
 }

 /**
 * Displays available voice commands
 */
 showHelp() {
 const commands = [...this.triggers.entries()].map(([cmd, config]) => ({
 command: cmd,
 priority: config.priority,
 isCritical: config.isCritical,
 alternatives: config.fuzzy
 }));
 const critical = commands.filter(c => c.isCritical).map(c => c.command).join(', ');
 this._emitStatus(`Critical commands: ${critical}. See console for all commands.`, 'info');
 console.log('Available Voice Commands:', commands);
 }

 /**
 * Returns performance metrics
 * @returns {Object} Metrics
 */
 getMetrics() {
 return {
 initTime: this.state.initTime,
 uptime: this.state.initializationTime ? (new Date() - this.state.initializationTime) / 1000 : 0,
 commandsProcessed: this.state.commandsProcessed,
 successfulCommands: this.state.successfulCommands,
 criticalCommandsProcessed: this.state.criticalCommandsProcessed,
 successRate: this.state.commandsProcessed > 0 ? (this.state.successfulCommands / this.state.commandsProcessed) * 100 : 0,
 averageConfidence: this.state.averageConfidence,
 errorCount: this.state.errorCount,
 whisperDetections: this.state.whisperDetections,
 averageProcessingTime: this.state.commandsProcessed > 0 ? this.state.totalProcessingTime / this.state.commandsProcessed : 0,
 retryCount: this.state.retryCount
 };
 }

 /**
 * Returns recent logs
 * @returns { Array} Logs
 */
 getLogs() {
 return [...this.state.logs];
 }

 /**
 * Returns misrecognized commands
 * @returns {Array} Misrecognized commands
 */
 getMisrecognizedCommands() {
 return [...this.state.misrecognizedCommands];
 }

 /**
 * Triggers a command manually
 * @param {string} commandName - Command to trigger
 * @returns {Promise<boolean>} Success status
 */
 async triggerCommand(commandName) {
 const trigger = this.triggers.get(commandName);
 if (trigger && this.callbacks[trigger.action]) {
 try {
 this.state.commandsProcessed++;
 if (trigger.isCritical) this.state.criticalCommandsProcessed++;
 this.state.successfulCommands++;
 await this.callbacks[trigger.action](commandName, 1.0);
 this._log(`Manually triggered command: ${commandName}`, 'success');
 return true;
 } catch (error) {
 this._handleError(`Failed to trigger command ${commandName}`, { error });
 return false;
 }
 }
 return false;
 }

 /**
 * Shuts down the voice recognition system
 * @returns {Promise<void>}
 */
 async shutdown() {
 await this.stopListening();
 this.state.isInitialized = false;
 this.state.recognition = null;
 this.state.audioContext = null;
 this.state.mediaStream = null;
 this.state.audioFile = null;
 this.state.logs = [];
 this.state.misrecognizedCommands = [];
 this._emitStatus('Voice recognition system shut down', 'info');
 }
}