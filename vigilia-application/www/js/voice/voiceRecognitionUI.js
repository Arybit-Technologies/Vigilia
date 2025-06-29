class VoiceRecognitionUI {
    constructor(appInstance) {
        this.app = appInstance;
        this.recognitionSystem = null;
        this.isRecording = false;
        this.sessionStartTime = null;

        // DOM elements
        this.micButton = document.getElementById('micButton');
        this.speakBtn = document.getElementById('speakBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopButton = document.getElementById('stopButton');
        this.clearButton = document.getElementById('clearButton');
        this.transcript = document.getElementById('transcript');
        this.status = document.getElementById('status');
        this.wordCount = document.getElementById('wordCount');
        this.confidenceLevel = document.getElementById('confidenceLevel');
        this.confidenceFill = document.getElementById('confidenceFill');
        this.sessionTime = document.getElementById('sessionTime');
        this.languageSelect = document.getElementById('languageSelect');
        this.continuousSelect = document.getElementById('continuousSelect');
        this.supportWarning = document.getElementById('supportWarning');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsDropdown = document.getElementById('settingsDropdown');

        // Initialize
        this.init();
    }

    async init() {
        // Check browser support
        if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
            this.supportWarning.style.display = 'block';
            this.micButton.classList.add('disabled');
            return;
        }

        // Initialize voice recognition system
        try {
            await this.app.setupVoiceRecognition();
            this.recognitionSystem = this.app._voiceRecognition;
            this.updateStatus('ready', 'System Ready');
        } catch (error) {
            this.updateStatus('error', 'Initialization Failed');
            console.error('UI: Initialization error:', error);
        }

        // Bind event listeners
        this.micButton.addEventListener('click', () => this.toggleRecognition());
        this.speakBtn.addEventListener('click', () => this.handleSpeak());
        this.pauseBtn.addEventListener('click', () => this.handlePause());
        this.stopButton.addEventListener('click', () => this.stopRecognition());
        this.clearButton.addEventListener('click', () => this.clearTranscript());
        this.settingsBtn.addEventListener('click', () => this.toggleSettings());
        this.languageSelect.addEventListener('change', () => this.updateLanguage());
        this.continuousSelect.addEventListener('change', () => this.updateContinuousMode());

        // Populate voice select (for text-to-speech, if implemented)
        this.populateVoiceSelect();

        // Start session timer
        this.updateSessionTime();
    }

    updateStatus(state, message) {
        this.status.className = `status ${state}`;
        this.status.innerHTML = `<span>⬤</span>${message}<div class="status-container">
            <span>Word Count: <span id="wordCount">${this.wordCount.innerText}</span> words</span>
            <span>Confidence: <span id="confidenceLevel">${this.confidenceLevel.innerText}</span></span>
            <div id="confidenceFill" style="width: ${this.confidenceFill.style.width}; height: 4px; background: #00d4ff;"></div>
            <span>Session Time: <span id="sessionTime">${this.sessionTime.innerText}</span></span>
        </div>`;
    }

    async toggleRecognition() {
        if (!this.recognitionSystem) return;

        this.isRecording = !this.isRecording;
        if (this.isRecording) {
            this.micButton.classList.add('recording');
            this.updateStatus('listening', 'Listening...');
            try {
                await this.recognitionSystem.startListening();
                this.sessionStartTime = new Date();
            } catch (error) {
                this.updateStatus('error', 'Failed to start listening');
                console.error('UI: Start listening error:', error);
                this.isRecording = false;
                this.micButton.classList.remove('recording');
            }
        } else {
            this.micButton.classList.remove('recording');
            this.updateStatus('ready', 'System Ready');
            await this.recognitionSystem.shutdown();
        }
    }

    async stopRecognition() {
        if (this.recognitionSystem && this.isRecording) {
            this.isRecording = false;
            this.micButton.classList.remove('recording');
            this.updateStatus('ready', 'System Ready');
            await this.recognitionSystem.shutdown();
        }
    }

    clearTranscript() {
        this.transcript.innerText = '';
        this.transcript.classList.remove('has-content');
        this.wordCount.innerText = '0';
    }

    handleSpeak() {
        // Placeholder for text-to-speech functionality
        console.log('Speak button clicked');
        // Example: Use Web Speech API's SpeechSynthesis
        const utterance = new SpeechSynthesisUtterance(this.transcript.innerText);
        utterance.lang = this.languageSelect.value;
        window.speechSynthesis.speak(utterance);
    }

    handlePause() {
        // Pause recognition if supported by VoiceRecognition
        if (this.recognitionSystem && this.isRecording) {
            this.updateStatus('processing', 'Paused');
            console.log('Pause button clicked');
            // Implement pause logic if VoiceRecognition supports it
        }
    }

    populateVoiceSelect() {
        if (window.speechSynthesis) {
            const updateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                this.voiceSelect.innerHTML = '<option value="">Select a voice</option>';
                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.text = `${voice.name} (${voice.lang})`;
                    this.voiceSelect.appendChild(option);
                });
            };
            updateVoices();
            window.speechSynthesis.onvoiceschanged = updateVoices;
        }
    }

    updateLanguage() {
        const language = this.languageSelect.value;
        this.app.language = language;
        this.recognitionSystem.config.language = language;
        this.recognitionSystem.setupVoiceRecognition(); // Reinitialize with new language
        this.updateStatus('processing', 'Updating language...');
    }

    updateContinuousMode() {
        const continuous = this.continuousSelect.value === 'true';
        this.recognitionSystem.config.continuous = continuous;
        this.recognitionSystem.setupVoiceRecognition(); // Reinitialize with new mode
        this.updateStatus('processing', 'Updating recognition mode...');
    }

    updateSessionTime() {
        setInterval(() => {
            if (this.sessionStartTime) {
                const elapsed = Math.floor((new Date() - this.sessionStartTime) / 1000);
                const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
                const seconds = String(elapsed % 60).padStart(2, '0');
                this.sessionTime.innerText = `${minutes}:${seconds}`;
            }
        }, 1000);
    }

    // Update transcript and metrics from recognition results
    updateTranscript(transcript, confidence) {
        if (transcript) {
            this.transcript.innerText = transcript;
            this.transcript.classList.add('has-content');
            const words = transcript.trim().split(/\s+/).length;
            this.wordCount.innerText = words;
            this.confidenceLevel.innerText = `${Math.round(confidence * 100)}%`;
            this.confidenceFill.style.width = `${confidence * 100}%`;
            this.updateStatus('processing', 'Processing...');
        }
    }

    toggleSettings() {
        this.settingsDropdown.classList.toggle('open');
    }
}