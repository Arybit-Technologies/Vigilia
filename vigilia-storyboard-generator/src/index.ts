import { StoryboardTemplate } from './components/StoryboardTemplate';
import { fetchTemplates } from './figma/api';
import { formatData } from './utils/helpers';

const init = async () => {
    console.log('Initializing Vigilia Storyboard Generator...');

    // Fetch existing templates from Figma
    const templates = await fetchTemplates();
    const formattedTemplates = formatData(templates);

    // Create a new storyboard template
    const storyboard = new StoryboardTemplate();
    storyboard.createTemplate(formattedTemplates);

    // Render the storyboard template
    storyboard.renderTemplate();
};

init();