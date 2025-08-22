// webhooks.app.uninstalled.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Clean up Shopify session rows
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // 🗑️ Clean up shop config so old token & carrier service details are removed
  try {
    await db.shopConfig.delete({ where: { shop } });
    console.log(`🗑️ Deleted ShopConfig for ${shop}`);
  } catch (err) {
    console.log(`⚠️ No ShopConfig found for ${shop}, skipping delete.`);
  }

  return new Response();
};
