/**
 * Bump when the decoded output changes shape (for example slot keys), so datasets scraped before the
 * change are re-saved on their next refresh instead of being treated as unchanged.
 */
export const DATA_REVISION = 2;
