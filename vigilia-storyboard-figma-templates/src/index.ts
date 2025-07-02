import { SheFeltFollowedTemplate } from './components/SheFeltFollowedTemplate';
import { WeeklyConceptTemplates } from './components/WeeklyConceptTemplates';
import { fetchTemplates } from './figma/api';
import { formatData } from './utils/helpers';

const init = async () => {
    console.log('Initializing Vigilia Storyboard Figma Templates...');

    // Fetch existing templates from Figma
    const templates = await fetchTemplates();
    const formattedTemplates = formatData(templates);

    // Create and render the "She Felt Followed" storyboard template
    const sheFeltFollowed = new SheFeltFollowedTemplate();
    sheFeltFollowed.createTemplate(formattedTemplates['She Felt Followed']);
    sheFeltFollowed.renderTemplate();

    // Create and render weekly concept templates
    const weeklyConcepts = new WeeklyConceptTemplates();
    weeklyConcepts.createTemplates(formattedTemplates['Weekly Concepts']);
    weeklyConcepts.renderTemplates();
};

init();