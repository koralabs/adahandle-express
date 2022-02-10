
// Fix from https://stackoverflow.com/questions/18391212/is-it-not-possible-to-stringify-an-error-using-json-stringify
if (!('toJSON' in Error.prototype))
    Object.defineProperty(Error.prototype, 'toJSON', {
        value: function () {
            const alt = {};

            Object.getOwnPropertyNames(this).forEach((key) => {
                alt[key] = this[key];
            }, this);

            return alt;
        },
        configurable: true,
        writable: true
    });

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
    public static log(args: { message: string, category?: LogCategory, event?: string, milliseconds?: number, count?: number, dimensions?: string[] } | string): void {
        if (typeof args === 'string') {
            this.log_entry(LogCategory.INFO, args);
            return;
        }
        const { message, category, event, milliseconds, count, dimensions } = args;
        this.log_entry(category ?? LogCategory.INFO, message, event, milliseconds, count, dimensions);
    }

    private static log_entry(category: LogCategory, message: string, event?: string, milliseconds?: number, count?: number, dimensions?: string[]): void {
        const now = (new Date()).toISOString();
        message = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); // escape double quotes and already escaped escapes
        const log_event = event ? `, "event": "${event}"` : "";
        const log_milliseconds = (milliseconds != undefined && milliseconds != null) ? `, "milliseconds": ${milliseconds}` : "";
        const log_count = (count != undefined && count != null) ? `, "count": ${count}` : "";
        const log_dimensions = (dimensions && Object.keys(dimensions).length) ? `, "dimensions": ${JSON.stringify(dimensions)}` : "";
        console.log(`{ "category": "${category ?? LogCategory.INFO}", "message": "${message}"${log_event}, "timestamp": "${now}"${log_milliseconds}${log_count}${log_dimensions} }`);
    }
}