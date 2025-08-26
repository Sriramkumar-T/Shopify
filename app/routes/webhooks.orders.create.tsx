// app/routes/webhooks.orders.create.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.webhook(request);

  if (ctx.topic === "ORDERS_CREATE") {
    // ctx.payload is already parsed
    const order: any = ctx.payload;
    console.log(`🆕 Order created in ${ctx.shop}:`, order?.id);
  }

  return new Response("OK");
};
