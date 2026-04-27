// Landing page: serves the Claude Design v2 layout from ./v2/page.tsx.
// The v2 directory remains accessible at /v2 as a backup for visual rollback
// during the design refresh window. Once the new design is confirmed stable
// in production, the v2 directory can be merged into this file and removed.
export { default, metadata } from "./v2/page";
