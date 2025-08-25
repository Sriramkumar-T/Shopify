// app/routes/auth.$shopify.tsx
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { registerWebhooks } from "../services/webhooks";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Register all webhooks right after authentication
  await registerWebhooks(session);

  // Redirect to home/dashboard after install
  return redirect("/");
};
