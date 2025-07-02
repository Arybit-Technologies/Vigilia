class CreatorTemplate {
    constructor() {
        this.prompt = "Hey 👋, we’re filming short videos for Vigilia, a 1-Tap Emergency Safety App. Here’s a short script you can use (feel free to be authentic!):";
        this.guidelines = [
            "Film in selfie mode",
            "Keep it raw (no filters)",
            "Mention: '1 Tap', 'emergency alert', 'free to try'",
            "Add: 'Download Vigilia' or 'Every woman should have this app'"
        ];
    }

    generatePrompt() {
        return `${this.prompt}\n\n🗣 “I used Vigilia last weekend when I felt unsafe walking home… One tap and my sister got my location. Honestly, I’ve never felt safer with an app.”`;
    }

    getGuidelines() {
        return this.guidelines;
    }
}

export default CreatorTemplate;