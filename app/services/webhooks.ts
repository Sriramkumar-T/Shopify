// app/services/webhooks.ts
// We use shopify.app.toml to register webhooks, so this is a no-op.
// Keeping the function so existing imports/calls don't break.
import type { Session } from "@shopify/shopify-app-remix/server";

export async function registerWebhooks(_session: Session) {
  // no-op: webhooks are configured in shopify.app.toml
  // Removed orders/create and orders/updated to avoid protected data issues
}
