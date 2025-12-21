import constants from '../helpers/constants.js';
import logger from '../helpers/logger.js';

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  console.log(err);
  if (err.code === 11000) {
    const keyPattern = err.keyPattern || {};
    const keyValue = err.keyValue || {};
    const field = Object.keys(keyPattern)[0] || 'field';
    const value = keyValue[field] || '';

    const message = `Duplicate value for ${value ? `: ${value}` : ''}`;
    logger.error(`Error: ${message}`);
    return res.status(409).json({
      status: false,
      error: message
    });
  }

  const statusCode = err.status || constants.HTTPS_INTERNAL_ERROR;
  logger.error(`Error : ${err.message}`);
  return res.status(statusCode).json({ status: false, error: err.message ? err.message : 'Internal Server Error' });
};

export default errorHandler;
