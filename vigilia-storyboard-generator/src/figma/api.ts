import axios from 'axios';

const FIGMA_API_URL = 'https://api.figma.com/v1';

export const fetchTemplates = async (fileId: string, accessToken: string) => {
    try {
        const response = await axios.get(`${FIGMA_API_URL}/files/${fileId}`, {
            headers: {
                'X-Figma-Token': accessToken,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching templates:', error);
        throw error;
    }
};

export const uploadTemplate = async (fileId: string, templateData: any, accessToken: string) => {
    try {
        const response = await axios.post(`${FIGMA_API_URL}/files/${fileId}/versions`, templateData, {
            headers: {
                'X-Figma-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading template:', error);
        throw error;
    }
};