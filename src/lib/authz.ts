// Capabilities seam (G2, G10): the single source for capability names.
// Business code checks capabilities, never role names. The list mirrors
// docs/requirements/access-control.md; roles are data (rows), not code.
// can() / requireCapability() land with M1's vertical slice.

export const CAPABILITIES = [
  "time.track",
  "time.view.all",
  "rate.view",
  "client.manage",
  "project.manage",
  "invoice.manage",
  "company.settings",
  "users.manage",
  "roles.manage",
  "billing.account",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
