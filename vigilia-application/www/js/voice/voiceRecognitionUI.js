class VoiceRecognitionUI {
    constructor(options = {}) {
        this.recognition = options.recognition || null; // Reference to VoiceRecognition (passed or lazily instantiated)
        this.callbacks = {
            onStartListening: () => {
                if (this.recognition) this.recognition.startListening();
            },
            onStopListening: () => {
                if (this.recognition) this.recognition.stopListening();
            },
            onClearTranscript: () => {
                if (this.recognition) this.recognition.clearTranscript();
            },
            onSetLanguage: (lang) => {
                if (this.recognition) this.recognition.setLanguage(lang);
            },
            onSetContinuousListening: (enabled) => {
                if (this.recognition) this.recognition.setContinuousListening(enabled);
            },
            onStatus: () => {},
            ...options.callbacks
        };

        this.state = {
            isRecording: false,
            isPaused: false,
            sessionStartTime: null,
            sessionTimer: null,
            finalTranscript: '',
            interimTranscript: '',
            lastConfidence: 0,
            autoSaveEnabled: true,
            selectedVoice: null
        };

        this.elements = {
            micButton: document.getElementById('micButton'),
            speakBtn: document.getElementById('speakBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            stopButton: document.getElementById('stopButton'),
            clearButton: document.getElementById('clearButton'),
            transcript: document.getElementById('transcript'),
            status: document.getElementById('status'),
            wordCount: document.getElementById('wordCount'),
            confidenceLevel: document.getElementById('confidenceLevel'),
            confidenceFill: document.getElementById('confidenceFill'),
            sessionTime: document.getElementById('sessionTime'),
            languageSelect: document.getElementById('languageSelect'),
            continuousSelect: document.getElementById('continuousSelect'),
            autoSaveSelect: document.getElementById('autoSaveSelect'),
            voiceSelect: document.getElementById('voiceSelect'),
            supportWarning: document.getElementById('supportWarning')
        };

        this.init();
    }

    initializeRecognition() {
        if (!this.recognition && typeof VoiceRecognition !== 'undefined') {
            this.recognition = new VoiceRecognition({
                ui: this, // Pass reference to VoiceRecognitionUI
                callbacks: {
                    onResult: (transcript, confidence) => this.updateTranscript(transcript, confidence),
                    onStatus: (msg, type) => this.updateStatus(type, msg),
                    onError: (msg) => this.showWarning(msg),
                    onWhisperDetected: () => this.updateStatus('listening', '🔊 Whisper detected')
                }
            });
            console.log('VoiceRecognition instantiated in VoiceRecognitionUI');
        }
    }

    init() {
        if (!window.isSecureContext) {
            this.showWarning('Speech recognition requires a secure context (HTTPS).');
            return;
        }
        this.populateSelectOptions();
        this.populateVoiceSelect();
        this.bindEvents();
        this.updateStatus('ready', '🟢 System Ready');

        // Initialize VoiceRecognition if not already passed
        if (!this.recognition) {
            this.initializeRecognition();
        }
    }

    populateSelectOptions() {
        const configs = {
            languageSelect: [
                { value: 'en-US', label: 'English (US)' },
                { value: 'es-ES', label: 'Spanish (Spain)' },
                { value: 'fr-FR', label: 'French' },
                { value: 'de-DE', label: 'German' },
                { value: 'sw-KE', label: 'Swahili' },
                { value: 'hi-IN', label: 'Hindi' }
            ],
            continuousSelect: [
                { value: 'true', label: 'Continuous Recognition' },
                { value: 'false', label: 'Single Command' }
            ],
            autoSaveSelect: [
                { value: 'true', label: 'Enabled' },
                { value: 'false', label: 'Disabled' }
            ]
        };

        Object.entries(configs).forEach(([selectId, options]) => {
            const select = this.elements[selectId];
            if (!select) return;
            select.innerHTML = '';
            options.forEach(({ value, label }) => {
                select.appendChild(new Option(label, value));
            });
        });
    }

    populateVoiceSelect() {
        const updateVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            this.elements.voiceSelect.innerHTML = '<option value="">Select a voice</option>';
            voices.forEach((voice, index) => {
                this.elements.voiceSelect.appendChild(
                    new Option(`${voice.name} (${voice.lang})${voice.default ? ' [default]' : ''}`, index)
                );
            });
            const defaultVoice = voices.find(v => v.lang === this.elements.languageSelect.value) || voices[0];
            if (defaultVoice) {
                this.elements.voiceSelect.value = voices.indexOf(defaultVoice);
                this.state.selectedVoice = defaultVoice;
            }
        };
        window.speechSynthesis.onvoiceschanged = updateVoices;
        updateVoices();
    }

    bindEvents() {
        this.elements.micButton?.addEventListener('click', this.debounce(() => this.toggleRecognition(), 300));
        this.elements.pauseBtn?.addEventListener('click', () => this.handlePause());
        this.elements.stopButton?.addEventListener('click', () => this.callbacks.onStopListening());
        this.elements.clearButton?.addEventListener('click', () => this.callbacks.onClearTranscript());
        this.elements.speakBtn?.addEventListener('click', () => this.handleSpeak());
        this.elements.languageSelect?.addEventListener('change', () => this.callbacks.onSetLanguage(this.elements.languageSelect.value));
        this.elements.continuousSelect?.addEventListener('change', () => this.callbacks.onSetContinuousListening(this.elements.continuousSelect.value === 'true'));
        this.elements.autoSaveSelect?.addEventListener('change', () => this.updateAutoSave());
        this.elements.voiceSelect?.addEventListener('change', () => this.updateSelectedVoice());
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    showWarning(message) {
        if (this.elements.supportWarning) {
            this.elements.supportWarning.textContent = message;
            this.elements.supportWarning.style.display = 'block';
        }
        this.elements.micButton?.classList.add('disabled');
        this.updateStatus('error', '❌ Not Supported');
    }

    updateStatus(state, message) {
        if (this.elements.status) {
            this.elements.status.className = `status ${state}`;
            this.elements.status.setAttribute('aria-live', 'polite');
            this.elements.status.innerHTML = `
                <span aria-label="${message}">${message}</span>
                <div class="status-container">
                    <span>Word Count: <span id="wordCount">${this.elements.wordCount?.textContent || 0}</span> words</span>
                    <span>Confidence: <span id="confidenceLevel">${this.elements.confidenceLevel?.textContent || '0%'}</span></span>
                    <div id="confidenceFill" style="width: ${this.elements.confidenceFill?.style.width || '0%'}; height: 4px; background: #00d4ff;"></div>
                    <span>Session Time: <span id="sessionTime">${this.elements.sessionTime?.textContent || '00:00'}</span></span>
                </div>`;
        }
        this.callbacks.onStatus(message, state);
    }

    updateTranscript(transcript, confidence) {
        if (confidence > 0) {
            this.state.finalTranscript = transcript;
            this.state.interimTranscript = '';
            this.state.lastConfidence = confidence;
        } else {
            this.state.interimTranscript = transcript.slice(this.state.finalTranscript.length);
        }

        const text = this.state.finalTranscript + this.state.interimTranscript;
        if (this.elements.transcript) {
            this.elements.transcript.textContent = text || 'Your speech will appear here...';
            this.elements.transcript.classList.toggle('has-content', !!text.trim());
        }
        if (this.elements.wordCount) {
            this.elements.wordCount.textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
        }
        if (this.elements.confidenceLevel) {
            this.elements.confidenceLevel.textContent = `${Math.round(this.state.lastConfidence * 100)}%`;
            this.elements.confidenceFill.style.width = `${this.state.lastConfidence * 100}%`;
        }
        if (this.state.autoSaveEnabled && text.trim()) {
            try {
                localStorage.setItem('vigilia_auto_transcript', text);
                this.updateStatus('processing', '💾 Auto-saved');
                setTimeout(() => this.updateStatus('ready', '🟢 System Ready'), 1200);
            } catch {
                this.updateStatus('error', '⚠️ Auto-save failed: Storage full');
            }
        }
    }

    toggleRecognition() {
        if (this.state.isRecording) {
            this.callbacks.onStopListening();
            this.state.isRecording = false;
            this.state.isPaused = false;
            this.elements.micButton?.classList.remove('recording');
            this.elements.pauseBtn.textContent = '⏸️ Pause';
            this.stopSessionTimer();
        } else {
            this.callbacks.onStartListening();
            this.state.isRecording = true;
            this.elements.micButton?.classList.add('recording');
            this.startSessionTimer();
        }
    }

    handlePause() {
        if (this.state.isRecording && !this.state.isPaused) {
            this.state.isPaused = true;
            this.callbacks.onStopListening();
            this.elements.pauseBtn.textContent = '▶️ Resume';
            this.updateStatus('ready', '⏸️ Paused');
            this.stopSessionTimer();
        } else if (this.state.isPaused) {
            this.state.isPaused = false;
            this.callbacks.onStartListening();
            this.elements.pauseBtn.textContent = '⏸️ Pause';
            this.updateStatus('listening', '🎙️ Listening...');
            this.startSessionTimer();
        }
    }

    handleSpeak() {
        const text = this.state.finalTranscript.trim();
        if (!text) {
            this.updateStatus('error', '⚠️ No text to speak');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.state.selectedVoice) utterance.voice = this.state.selectedVoice;
        utterance.lang = this.elements.languageSelect.value;
        window.speechSynthesis.speak(utterance);
        this.updateStatus('ready', '🔊 Speaking...');
        setTimeout(() => this.updateStatus('ready', '🟢 System Ready'), 1200);
    }

    updateSelectedVoice() {
        const index = this.elements.voiceSelect.value;
        this.state.selectedVoice = index ? window.speechSynthesis.getVoices()[index] : null;
    }

    updateAutoSave() {
        this.state.autoSaveEnabled = this.elements.autoSaveSelect.value === 'true';
        this.updateStatus('processing', '💾 Auto-save setting updated');
        setTimeout(() => this.updateStatus('ready', '🟢 System Ready'), 1200);
    }

    startSessionTimer() {
        if (this.state.sessionTimer) return;
        this.state.sessionStartTime = new Date();
        this.state.sessionTimer = setInterval(() => {
            const elapsed = Math.floor((new Date() - this.state.sessionStartTime) / 1000);
            this.elements.sessionTime.textContent = `${Math.floor(elapsed / 60)
                .toString()
                .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopSessionTimer() {
        if (this.state.sessionTimer) {
            clearInterval(this.state.sessionTimer);
            this.state.sessionTimer = null;
            this.elements.sessionTime.textContent = '00:00';
        }
    }
}