/**
 * asyncHandler - Express async route handler wrapper
 * Eliminates repetitive try/catch blocks in route handlers.
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
