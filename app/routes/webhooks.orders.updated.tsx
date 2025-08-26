// app/routes/webhooks.orders.updated.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.webhook(request);

  if (ctx.topic === "ORDERS_UPDATED") {
    const order: any = ctx.payload;
    console.log(`✏️ Order updated in ${ctx.shop}:`, order?.id);
  }

  return new Response("OK");
};
