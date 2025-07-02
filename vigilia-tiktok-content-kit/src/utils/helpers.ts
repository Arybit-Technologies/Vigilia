export function formatData(data: any): string {
    return JSON.stringify(data, null, 2);
}

export function validateInput(input: any): boolean {
    return input !== null && input !== undefined && input !== '';
}

export function generateTimestamp(): string {
    const now = new Date();
    return now.toISOString();
}

export function logError(message: string): void {
    console.error(`[ERROR] ${generateTimestamp()}: ${message}`);
}