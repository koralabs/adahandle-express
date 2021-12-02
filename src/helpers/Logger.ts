export enum LogCategory {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL',
    NOTIFY = 'NOTIFY',
    METRIC = 'METRIC',
}

export class Logger {
    public static log(args: { message: string, category?: LogCategory, event?: string } | string): void {
        if (typeof args === 'string') {
            console.log(`{ "category": "LogCategory.INFO", "message": ${args}" }`);
            return;
        }

        const { message, category, event } = args;
        console.log(`{ "category": "${category ?? LogCategory.INFO}", "message": "${message}", "event: ${event}" }`);
    }
}