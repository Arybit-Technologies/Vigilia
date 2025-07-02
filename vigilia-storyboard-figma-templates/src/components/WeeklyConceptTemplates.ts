class WeeklyConceptTemplates {
    constructor() {
        this.concepts = [
            {
                day: 'Monday',
                theme: 'Fear Scenario',
                visual: 'A woman looking over her shoulder in a dimly lit street',
                text: '“She was being followed… She had 1 tap.”',
                notes: 'Use suspenseful music and close-up shots.'
            },
            {
                day: 'Wednesday',
                theme: 'UGC Story',
                visual: 'A person speaking directly to the camera',
                text: '“I used Vigilia last Friday. It actually works.”',
                notes: 'Keep it authentic and relatable.'
            },
            {
                day: 'Friday',
                theme: 'Challenge',
                visual: 'A countdown timer on screen',
                text: '“Show us how fast YOU can tap Vigilia 💜 #1TapChallenge”',
                notes: 'Incorporate upbeat music and fun visuals.'
            },
            {
                day: 'Saturday',
                theme: 'Stat Awareness',
                visual: 'Infographic showing safety statistics',
                text: '“Most women feel unsafe walking alone. Here’s a free app that helps.”',
                notes: 'Use clear graphics and impactful statistics.'
            },
            {
                day: 'Sunday',
                theme: 'Family Feature',
                visual: 'A group of friends or family members',
                text: '“Add your mom, partner, or bestie. They’ll know when you’re in danger.”',
                notes: 'Highlight the importance of community and support.'
            }
        ];
    }

    createTemplate(dayIndex) {
        if (dayIndex < 0 || dayIndex >= this.concepts.length) {
            throw new Error('Invalid day index');
        }
        const concept = this.concepts[dayIndex];
        return {
            day: concept.day,
            theme: concept.theme,
            visual: concept.visual,
            text: concept.text,
            notes: concept.notes
        };
    }

    renderTemplates() {
        return this.concepts.map((concept, index) => this.createTemplate(index));
    }
}

export default WeeklyConceptTemplates;