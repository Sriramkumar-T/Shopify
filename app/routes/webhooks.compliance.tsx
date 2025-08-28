import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`, { payload });

    switch (topic) {
      case "customers/data_request":
        // Log or email data request (if any data stored)
        break;
      case "customers/redact":
        // Delete/anonymize customer data (if stored)
        break;
      case "shop/redact":
        // Delete shop data (sent 48h after uninstall)
        break;
      default:
        console.warn(`Unhandled compliance topic: ${topic}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Error processing compliance webhook:", err);
    return new Response("Webhook processing failed", { status: 400 });
  }
};