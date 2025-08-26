import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const ctx = await authenticate.webhook(request);
    console.log(`Received ${ctx.topic} webhook for ${ctx.shop}`, {
      headers: Object.fromEntries(request.headers.entries()),
      payload: ctx.payload,
    });

    if (ctx.topic === "APP_UNINSTALLED" && ctx.shop) {
      await prisma.$transaction([
        prisma.session.deleteMany({ where: { shop: ctx.shop } }),
        prisma.shopConfig.deleteMany({ where: { shop: ctx.shop } }),
      ]);
      console.log(`✅ Cleared data for shop: ${ctx.shop}`);
    } else {
      console.warn(`Unexpected topic or missing shop: ${ctx.topic}, ${ctx.shop}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Error processing APP_UNINSTALLED webhook:", {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
};