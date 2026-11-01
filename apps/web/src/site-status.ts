/**
 * While true, every page shows the decommission notice (app/decommissioned) and every API route
 * answers SITE_DECOMMISSIONED. Nothing else is removed: set this to false and redeploy to bring the
 * site back as it was. The switch is applied in proxy.ts.
 */
export const DECOMMISSIONED = false;

/** The notice's internal route. Visitors only ever see it at "/". */
export const NOTICE_PATH = '/decommissioned';
