import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`, { payload });

    const current = payload.current as string[];
    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { scope: current.join(",") },
      });
      console.log(`Updated session scopes for ${shop}`);
    } else {
      console.warn(`No session found for ${shop}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Error processing APP_SCOPES_UPDATE webhook:", {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
};