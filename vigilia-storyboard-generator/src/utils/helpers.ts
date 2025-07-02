// filepath: vigilia-storyboard-generator/vigilia-storyboard-generator/src/utils/helpers.ts
export function formatData(data: any): string {
    // Function to format data for storyboard templates
    return JSON.stringify(data, null, 2);
}

export function validateInput(input: any): boolean {
    // Function to validate user input
    return input !== null && input !== undefined && input !== '';
}