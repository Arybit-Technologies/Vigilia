class StoryboardTemplate {
    constructor(title, duration) {
        this.title = title;
        this.duration = duration;
        this.scenes = [];
    }

    createTemplate(sceneDetails) {
        const scene = {
            timestamp: sceneDetails.timestamp,
            visual: sceneDetails.visual,
            audio: sceneDetails.audio,
            notes: sceneDetails.notes,
        };
        this.scenes.push(scene);
    }

    renderTemplate() {
        return {
            title: this.title,
            duration: this.duration,
            scenes: this.scenes,
        };
    }
}

export default StoryboardTemplate;