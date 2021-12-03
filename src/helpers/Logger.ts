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
            this.log_entry(LogCategory.INFO, args);
            return;
        }
        const { message, category, event } = args;
        this.log_entry(category ?? LogCategory.INFO, message, event);
    }

    private static log_entry(category: LogCategory, message: string, event?: string): void {
        const now = (new Date()).toISOString();
        console.log(`{ "category": "${category ?? LogCategory.INFO}", "message": "${message}", "event: ${event}" , "timestamp": "${now}" }`);
    }
}