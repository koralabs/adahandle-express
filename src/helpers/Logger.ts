import * as fs from 'fs'

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
    private static fileLogger = fs.createWriteStream('./logs/application.log', {
      flags: 'w' // 'a' means appending (old data will be preserved)
    })
    
    public static log(args: { message: string, category?: LogCategory, event?: string } | string): void {
        let category: LogCategory | undefined
        let message: string | undefined
        let event: string | undefined

        if (typeof args === 'string') {
            category = LogCategory.INFO
            message = args;
        }
        else {
            ({ message, category, event } = args);
        }
        const loggedLine = `{ "category": "${category ?? LogCategory.INFO}", "message": "${message}", "event: ${event}" }`

        console.log(loggedLine);
        Logger.fileLogger.write(loggedLine)
    }
}