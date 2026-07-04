/**
 * @kakoa/core — THE CONTRACT (PROJECT_PLAN.md §3.0 / §3.1).
 * Zero runtime deps beyond zod. Importable by client & server.
 */

export const CONTRACT_VERSION = '1.0.0';

export * from './enums';
export * from './errors';
export * from './envelope';
export * from './money';
export * from './gst';
export * from './gst-states';
export * from './datetime';
export * from './order-state-machine';
export * from './phone';
export * from './pincode';
export * from './contracts/index';
