export function formatData(data: any): string {
    return JSON.stringify(data, null, 2);
}

export function validateInput(input: any): boolean {
    return input !== null && input !== undefined && input !== '';
}