// app/services/webhooks.ts
import { DeliveryMethod } from "@shopify/shopify-api";
import shopify from "../shopify.server";
import type { Session } from "@shopify/shopify-app-remix/server";

// Helper to register all your app's webhooks
export async function registerWebhooks(session: Session) {
  await (shopify.registerWebhooks as any)({
    session,
    webhooks: {
      APP_UNINSTALLED: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/webhooks/app.uninstalled",
      },
      ORDERS_CREATE: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/webhooks/orders.create",
      },
      ORDERS_UPDATED: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/webhooks/orders.updated",
      },
    },
  });
}
