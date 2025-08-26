import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const ctx = await authenticate.webhook(request);
    console.log(`Received ${ctx.topic} webhook for ${ctx.shop}`, { payload: ctx.payload });

    if (ctx.topic === "ORDERS_UPDATED") {
      const order: any = ctx.payload;
      console.log(`✏️ Order updated in ${ctx.shop}:`, order?.id);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Error processing ORDERS_UPDATED webhook:", {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
};