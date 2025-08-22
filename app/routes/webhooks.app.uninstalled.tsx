// app/routes/webhooks.app.uninstalled.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { clearShopData } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`🛑 Uninstalled webhook | shop=${shop} topic=${topic}`);

  try {
    await clearShopData(shop);
    console.log(`✅ Deleted all data for ${shop}`);
  } catch (err) {
    console.error(`❌ Failed to clean ${shop}`, err);
  }

  // Respond 200 within 5s or Shopify retries
  return new Response("ok");
};
