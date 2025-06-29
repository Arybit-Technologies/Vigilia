/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * VoiceRecognition class for low-level speech recognition.
 * Supports Web Speech API and Cordova environments with continuous listening.
 */
class VoiceRecognition {
    /**
     * @param {Object} options - Configuration options for voice recognition.
     * @param {string} [options.language='en-US'] - The language for recognition.
     * @param {number} [options.minConfidence=0.7] - Minimum confidence score for a result to be considered.
     * @param {string} [options.platform='auto'] - 'Web', 'Cordova', or 'auto'.
     * @param {boolean} [options.continuous=true] - Whether to listen continuously.
     * @param {boolean} [options.interimResults=false] - Whether to return interim results.
     * @param {Object} [options.callbacks] - Callback functions for events.
     * @param {function(string, string)} [options.callbacks.onStatus] - Callback for status updates.
     * @param {function(string, Object)} [options.callbacks.onError] - Callback for errors.
     * @param {function(string, number)} [options.callbacks.onResult] - Callback for recognized results.
     * @param {function()} [options.callbacks.onWhisperDetected] - Callback for whisper detection (placeholder).
     */
    constructor(options = {}) {
        this.config = {
            language: 'en-US',
            minConfidence: 0.7,
            platform: 'auto', // 'Web', 'Cordova', 'auto'
            continuous: true,
            interimResults: false,
            ...options
        };

        this.callbacks = {
            onStatus: (msg, type = 'info') => console.log(`[VoiceRecognition Status][${type}] ${msg}`),
            onError: (msg, details = {}) => console.error(`[VoiceRecognition Error] ${msg}`, details),
            onResult: (transcript, confidence) => console.log(`[VoiceRecognition Result] "${transcript}" (Confidence: ${confidence})`),
            onWhisperDetected: () => console.log('[VoiceRecognition] Whisper detected'),
            ...options.callbacks
        };

        this._recognitionInstance = null;
        this._isListening = false;
        this._isSetup = false;
        this._isInitializing = false;
        this._platform = this.config.platform;
    }

    /**
     * Determines the speech recognition platform and initializes it.
     * @returns {Promise<void>} Resolves when setup is complete.
     */
    async setupVoiceRecognition() {
        if (this._isSetup || this._isInitializing) {
            this.callbacks.onStatus('Voice recognition setup already in progress or complete.', 'info');
            return;
        }

        this._isInitializing = true;
        this.callbacks.onStatus('Initializing voice recognition...', 'info');

        try {
            if (this._platform === 'auto') {
                if (typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
                    this._platform = 'Cordova';
                } else if (window.SpeechRecognition || window.webkitSpeechRecognition) {
                    this._platform = 'Web';
                } else {
                    throw new Error('No supported speech recognition API found on this device/browser.');
                }
            }

            if (this._platform === 'Web') {
                await this._setupWebSpeechAPI();
            } else if (this._platform === 'Cordova') {
                await this._setupCordovaSpeechRecognition();
            } else {
                throw new Error(`Unsupported platform specified: ${this._platform}`);
            }

            this._isSetup = true;
            this._isInitializing = false;
            this.callbacks.onStatus(`Voice recognition ready (${this._platform} API).`, 'success');
        } catch (error) {
            this._isInitializing = false;
            this._isSetup = false;
            this.callbacks.onError(`Failed to set up voice recognition: ${error.message}`, error);
            throw error; // Re-throw to propagate to EnhancedVoiceRecognitionSystem
        }
    }

    /**
     * Sets up the Web Speech API for recognition.
     * @private
     * @returns {Promise<void>}
     */
    _setupWebSpeechAPI() {
        return new Promise((resolve, reject) => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                return reject(new Error('Web Speech API not supported in this browser.'));
            }

            this._recognitionInstance = new SpeechRecognition();
            this._recognitionInstance.lang = this.config.language;
            this._recognitionInstance.continuous = this.config.continuous;
            this._recognitionInstance.interimResults = this.config.interimResults;
            this._recognitionInstance.maxAlternatives = 1; // Get only the most confident result

            this._recognitionInstance.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const confidence = event.results[0][0].confidence;
                if (confidence >= this.config.minConfidence) {
                    this.callbacks.onResult(transcript, confidence);
                } else {
                    this.callbacks.onStatus(`Low confidence result: "${transcript}" (${confidence.toFixed(2)})`, 'info');
                }
            };

            this._recognitionInstance.onerror = (event) => {
                let errorMessage = `Recognition error: ${event.error}`;
                if (event.error === 'no-speech') {
                    errorMessage = 'No speech detected. Please try again.';
                } else if (event.error === 'not-allowed') {
                    errorMessage = 'Microphone access denied. Please grant permission in browser settings.';
                } else if (event.error === 'network') {
                    errorMessage = 'Network error during recognition. Check your connection.';
                }
                this.callbacks.onError(errorMessage, { code: event.error, message: event.message });
            };

            this._recognitionInstance.onend = () => {
                this.callbacks.onStatus('Recognition service ended.', 'info');
                this._isListening = false;
                if (this.config.continuous) {
                    this.callbacks.onStatus('Restarting continuous recognition...', 'info');
                    this.startListening().catch(err => this.callbacks.onError('Failed to restart continuous listening', err));
                }
            };
 
            this._recognitionInstance.onstart = () => {
                this.callbacks.onStatus('Recognition service started.', 'info');
                this._isListening = true;
            };

            this._recognitionInstance.onspeechstart = () => {
                this.callbacks.onStatus('Speech detected.', 'info');
            };

            this._recognitionInstance.onspeechend = () => {
                this.callbacks.onStatus('Speech ended.', 'info');
            };

            // Attempt a start to check permissions and ensure it's functional
            try {
                this._recognitionInstance.start(); // This will trigger a permission prompt if not granted
                this._recognitionInstance.stop(); // Stop immediately after testing start
                resolve();
            } catch (e) {
                reject(new Error(`Error starting Web Speech API: ${e.message}. Check microphone access.`));
            }
        });
    }

    /**
     * Sets up the Cordova Speech Recognition plugin.
     * @private
     * @returns {Promise<void>}
     */
    _setupCordovaSpeechRecognition() {
        return new Promise(async (resolve, reject) => {
            if (typeof cordova === 'undefined' || !cordova.plugins?.speechRecognition) {
                return reject(new Error('Cordova Speech Recognition plugin not found.'));
            }

            const speechRecognition = cordova.plugins.speechRecognition;

            // Check and request permissions
            try {
                const hasPermission = await speechRecognition.hasPermission();
                if (!hasPermission) {
                    this.callbacks.onStatus('Requesting microphone permission...', 'info');
                    await speechRecognition.requestPermission();
                    const granted = await speechRecognition.hasPermission(); // Re-check after request
                    if (!granted) {
                        throw new Error('Microphone permission denied by user.');
                    }
                }
                this.callbacks.onStatus('Microphone permission granted.', 'success');
            } catch (error) {
                return reject(new Error(`Permission error: ${error.message}`));
            }

            // Cordova plugin doesn't have a direct "recognition instance" like Web API.
            // We'll manage state and continuous listening manually.
            this._isSetup = true; // Mark as setup before resolving
            resolve();
        });
    }

    /**
     * Starts listening for voice input.
     * @returns {Promise<boolean>} Resolves with true if listening started, false otherwise.
     */
    async startListening() {
        if (!this._isSetup) {
            this.callbacks.onError('Voice recognition is not set up. Call setupVoiceRecognition() first.', { code: 'NOT_SETUP' });
            return false;
        }
        if (this._isListening) {
            this.callbacks.onStatus('Already listening.', 'info');
            return true;
        }

        this.callbacks.onStatus('Starting to listen...', 'info');
        try {
            if (this._platform === 'Web') {

                //alert(this._platform);

                //this._recognitionInstance.start();
                this._isListening = true;
            } else if (this._platform === 'Cordova') {
                // Cordova plugin's startListening takes success/error callbacks
                const options = {
                    language: this.config.language,
                    matches: 1, // Number of results to return
                    prompt: 'Speak now...', // Android prompt (ignored by iOS)
                    showPopup: false // Set to true to show system popup on Android for non-continuous
                };

                // Use a wrapper to handle continuous listening if desired
                const cordovaListen = () => {
                    cordova.plugins.speechRecognition.startListening((matches) => {
                        if (matches && matches.length > 0) {
                            const transcript = matches[0]; // Take the most likely match
                            // Cordova plugin doesn't provide confidence directly, assume high if matched
                            this.callbacks.onResult(transcript, 1.0);
                        }
                        if (this.config.continuous && this._isListening) { // Only restart if still intended to be listening
                            cordovaListen(); // Recursively call to listen continuously
                        }
                    }, (error) => {
                        let errorMessage = 'Cordova recognition error';
                        // Specific error handling for Cordova plugin errors
                        if (error === 'No Result') {
                            errorMessage = 'No speech detected.';
                        } else if (error === 'Not available on device') {
                            errorMessage = 'Speech recognition not available on this device.';
                        } else if (error === 'Permission denied') {
                            errorMessage = 'Microphone permission denied.';
                        } else {
                            errorMessage = `Cordova recognition error: ${error}`;
                        }
                        this.callbacks.onError(errorMessage, { code: error });

                        this._isListening = false; // Stop listening on error
                        if (this.config.continuous && this._isSetup) { // Only attempt restart if setup and continuous
                            this.callbacks.onStatus('Attempting to restart Cordova continuous listening...', 'warning');
                            // Small delay before restart to prevent rapid retries on persistent errors
                            setTimeout(() => this.startListening().catch(err => {
                                this.callbacks.onError('Failed to restart Cordova listening after error', err);
                            }), 1000);
                        }
                    }, options);
                };

                cordovaListen(); // Initial call
                this._isListening = true;
            }
            this.callbacks.onStatus('Listening started.', 'success');
            return true;
        } catch (error) {
            this.callbacks.onError(`Error starting listening: ${error.message}`, error);
            this._isListening = false;
            return false;
        }
    }

    /**
     * Stops listening for voice input.
     * @returns {Promise<boolean>} Resolves with true if listening stopped, false otherwise.
     */
    async stopListening() {
        if (!this._isListening) {
            this.callbacks.onStatus('Not currently listening.', 'info');
            return true;
        }

        this.callbacks.onStatus('Stopping listening...', 'info');
        try {
            if (this._platform === 'Web' && this._recognitionInstance) {
                this._recognitionInstance.stop();
            } else if (this._platform === 'Cordova' && typeof cordova !== 'undefined' && cordova.plugins?.speechRecognition) {
                // For Cordova, we just tell it to stop, it will stop any ongoing recognition.
                // The onResult/onError callbacks won't be called after this.
                await cordova.plugins.speechRecognition.stopListening();
            }
            this._isListening = false;
            this.callbacks.onStatus('Listening stopped.', 'success');
            return true;
        } catch (error) {
            this.callbacks.onError(`Error stopping listening: ${error.message}`, error);
            return false;
        }
    }

    /**
     * Checks if the system is currently listening.
     * @returns {boolean} True if listening, false otherwise.
     */
    isListening() {
        return this._isListening;
    }

    /**
     * Checks if the voice recognition system has been successfully set up.
     * @returns {boolean} True if set up, false otherwise.
     */
    isSystemReady() {
        return this._isSetup;
    }
}