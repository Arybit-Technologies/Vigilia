import { SheFeltFollowedStoryboard } from './storyboards/SheFeltFollowedStoryboard';
import { WeeklyConceptsStoryboard } from './storyboards/WeeklyConceptsStoryboard';
import { CreatorTemplate } from './ugc/CreatorTemplate';

const init = () => {
    console.log('Initializing Vigilia TikTok Content Kit...');

    // Create and render the "She Felt Followed" storyboard
    const sheFeltFollowedStoryboard = new SheFeltFollowedStoryboard();
    sheFeltFollowedStoryboard.renderStoryboard();

    // Create and render weekly concepts storyboard
    const weeklyConceptsStoryboard = new WeeklyConceptsStoryboard();
    weeklyConceptsStoryboard.renderStoryboards();

    // Generate UGC creator template
    const creatorTemplate = new CreatorTemplate();
    creatorTemplate.generatePrompt();
};

init();