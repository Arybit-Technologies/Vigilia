class SheFeltFollowedStoryboard {
    constructor() {
        this.frames = [
            {
                timestamp: "0–2s",
                visual: "Dimly lit street, girl walking, looks over her shoulder",
                audioCaption: "Caption: “She felt someone following her…”",
                notes: "Add subtle wind + footstep sounds"
            },
            {
                timestamp: "3–4s",
                visual: "Girl unlocks phone nervously",
                audioCaption: "SFX: Heartbeat begins softly",
                notes: "POV close-up of screen"
            },
            {
                timestamp: "4–6s",
                visual: "She taps the Vigilia button on screen",
                audioCaption: "Caption: “1 Tap.”",
                notes: "Include app UI sound or soft alert"
            },
            {
                timestamp: "6–9s",
                visual: "Family gets alert SMS, GPS shown on map",
                audioCaption: "Caption: “Location shared. Family alerted.”",
                notes: "Use iMessage-style animation"
            },
            {
                timestamp: "10–12s",
                visual: "Girl enters shop or meets friend, visibly relieved",
                audioCaption: "Caption: “She’s safe.”",
                notes: "Cut to soft music and brighter lighting"
            },
            {
                timestamp: "13–15s",
                visual: "Purple screen: “Download Vigilia – Your Safety App”",
                audioCaption: "CTA: “One tap can save your life 💜” + “Try it free today”",
                notes: "Include logo and app store icons"
            }
        ];
    }

    createStoryboard() {
        return this.frames.map(frame => ({
            timestamp: frame.timestamp,
            visual: frame.visual,
            audioCaption: frame.audioCaption,
            notes: frame.notes
        }));
    }

    renderStoryboard() {
        const storyboard = this.createStoryboard();
        storyboard.forEach(frame => {
            console.log(`Timestamp: ${frame.timestamp}`);
            console.log(`Visual: ${frame.visual}`);
            console.log(`Audio/Caption: ${frame.audioCaption}`);
            console.log(`Notes: ${frame.notes}`);
            console.log('---');
        });
    }
}

export default SheFeltFollowedStoryboard;