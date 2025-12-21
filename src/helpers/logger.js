import { format, createLogger, transports } from 'winston';

const { combine, timestamp, label, printf } = format;
const CATEGORY = '';

//Using the printf format.
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = createLogger({
  level: process.env.LOGGER_LEVEL ? process.env.LOGGER_LEVEL : 'info',
  format: combine(label({ label: CATEGORY }), timestamp(), customFormat),
  transports: [new transports.Console()]
});

export default logger;
