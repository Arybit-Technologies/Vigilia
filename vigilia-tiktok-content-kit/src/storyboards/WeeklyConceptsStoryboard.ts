class WeeklyConceptsStoryboard {
    constructor() {
        this.concepts = [
            {
                day: 'Monday',
                theme: 'Fear Scenario',
                prompt: '“She was being followed… She had 1 tap.”'
            },
            {
                day: 'Wednesday',
                theme: 'UGC Story',
                prompt: '“I used Vigilia last Friday. It actually works.”'
            },
            {
                day: 'Friday',
                theme: 'Challenge',
                prompt: '“Show us how fast YOU can tap Vigilia 💜 #1TapChallenge”'
            },
            {
                day: 'Saturday',
                theme: 'Stat Awareness',
                prompt: '“Most women feel unsafe walking alone. Here’s a free app that helps.”'
            },
            {
                day: 'Sunday',
                theme: 'Family Feature',
                prompt: '“Add your mom, partner, or bestie. They’ll know when you’re in danger.”'
            }
        ];
    }

    createStoryboard(dayIndex) {
        if (dayIndex < 0 || dayIndex >= this.concepts.length) {
            throw new Error('Invalid day index');
        }
        const concept = this.concepts[dayIndex];
        return {
            day: concept.day,
            theme: concept.theme,
            prompt: concept.prompt
        };
    }

    renderStoryboards() {
        return this.concepts.map((concept, index) => this.createStoryboard(index));
    }
}

export default WeeklyConceptsStoryboard;