const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure the logs directory exists
const logs_dir = './logs';
if (!fs.existsSync(logs_dir)) {
    fs.mkdirSync(logs_dir, { recursive: true });
}

// Create a log file with the current timestamp as its name
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFilePath = path.join(logs_dir, `log-${timestamp}.txt`);

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: logFilePath })
    ],
});

module.exports = logger;
