/**
 * Shared logger with a [BKF] prefix for all console output.
 * In production builds (__DEV__ === false) all calls are no-ops so esbuild
 * can tree-shake them away entirely.
 */

export const LOG_PREFIX = '[BKF]';
/* global __DEV__ */
export const log  = __DEV__ ? (...args) => console.log(LOG_PREFIX, ...args)  : () => {};
export const warn = __DEV__ ? (...args) => console.warn(LOG_PREFIX, ...args) : () => {};
