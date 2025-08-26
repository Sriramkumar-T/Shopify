// app/routes/webhooks.app.uninstalled.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.webhook(request); // verifies HMAC and parses

  if (ctx.topic === "APP_UNINSTALLED" && ctx.shop) {
    const shop = ctx.shop;
    console.log(`🗑️ App uninstalled from ${shop}`);

    try {
      await prisma.session.deleteMany({ where: { shop } });
      await prisma.shopConfig.deleteMany({ where: { shop } });
      console.log(`✅ Cleaned up sessions + ShopConfig for ${shop}`);
    } catch (err) {
      console.error("❌ Cleanup failed:", err);
      return new Response("Cleanup failed", { status: 500 });
    }
  }

  return new Response("OK");
};
