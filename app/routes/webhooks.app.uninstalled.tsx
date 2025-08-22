// app/routes/webhooks.app.uninstalled.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`🛑 App uninstalled webhook received for shop: ${shop} (topic: ${topic})`);

  try {
    // Delete all session data for this shop
    await db.session.deleteMany({ where: { shop } });

    // Also delete any saved shop config / tokens from Supabase
    await db.shopConfig.deleteMany({ where: { shop } });

    console.log(`✅ Cleaned up data for shop: ${shop}`);
  } catch (error) {
    console.error(`❌ Error cleaning up shop data for ${shop}:`, error);
  }

  return new Response();
};
