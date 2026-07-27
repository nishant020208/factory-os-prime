/**
 * Re-export fireNotification using SPA navigation for the toast "View" button.
 * This module exists so the hook can stay pure (no router dependency), while
 * the navigation logic lives in a router-aware component.
 */
export { fireNotification } from "./notifications";
