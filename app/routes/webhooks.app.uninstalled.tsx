import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { clearShopData } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`🛑 App Uninstalled webhook received | shop=${shop} | topic=${topic}`);

  try {
    await clearShopData(shop);
    console.log(`✅ Successfully deleted all data for shop=${shop}`);
  } catch (err) {
    console.error(`❌ Failed to clean up shop=${shop}`, err);
  }

  // Always return 200, otherwise Shopify retries
  return new Response("ok");
};
