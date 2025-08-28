import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Handles both `/auth/:shop` and `/auth/callback`
 * - `/auth/:shop` → Starts OAuth
 * - `/auth/callback` → Completes OAuth and redirects into embedded app
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // Complete authentication
  const { session } = await authenticate.admin(request);

  // If it's the OAuth callback step, make sure we redirect cleanly
  if (request.url.includes("/auth/callback")) {
    return redirect(`/?shop=${session.shop}`);
  }

  // Otherwise (for /auth/:shop) continue normal flow
  return redirect("/");
};
