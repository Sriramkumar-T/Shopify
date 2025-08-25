// app/routes/webhooks.app.uninstalled.ts
import type { ActionFunctionArgs } from "@remix-run/node";
import shopify, { sessionStorage } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, session } = await shopify.authenticate.webhook(request);

    if (topic === "APP_UNINSTALLED") {
      console.log(`App uninstalled from ${shop}`);

      // Remove session from DB
      if (session) {
        await sessionStorage.deleteSession(session.id);
        console.log(`Deleted session for ${shop}`);
      }

      // If you also have a custom ShopConfig table, delete row here:
      // import { prisma } from "../db.server";
      // await prisma.shopConfig.deleteMany({ where: { shop } });
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Failed to process webhook:", error);
    return new Response("Error", { status: 500 });
  }
};
