/**
 * Shared logger with a [BKF] prefix for all console output.
 */

export const LOG_PREFIX = '[BKF]';
export const log = (...args) => console.log(LOG_PREFIX, ...args);
export const warn = (...args) => console.warn(LOG_PREFIX, ...args);
