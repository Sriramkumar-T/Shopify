// app/routes/_index.tsx
import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {prisma} from "../db.server";
import shopify from "../shopify.server";
import axios from "axios";
import { authenticate } from "../shopify.server";

const API_VERSION = "2025-07";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shopConfig = await prisma.shopConfig.findUnique({
    where: { shop: session.shop },
  });

  return json({ shopConfig });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const enabled = formData.get("enabled") === "on";
  const endpoint = formData.get("endpoint") as string;
  const apiKey = formData.get("apiKey") as string;

  try {
    if (enabled) {
      // Create or update carrier service
      const carrierService = {
        carrier_service: {
          name: "R8Connect Carrier Service",
          callback_url: `${process.env.APP_URL}/api/rate`,
          service_discovery: true,
        },
      };

      let carrierServiceId: string | null = null;

      const existing = await prisma.shopConfig.findUnique({
        where: { shop: session.shop },
      });

      if (existing?.carrierServiceId) {
        // update carrier service
        const response = await axios.put(
          `https://${session.shop}/admin/api/${API_VERSION}/carrier_services/${existing.carrierServiceId}.json`,
          carrierService,
          {
            headers: {
              "X-Shopify-Access-Token": session.accessToken,
              "Content-Type": "application/json",
            },
          }
        );
        carrierServiceId = response.data.carrier_service.id.toString();
      } else {
        // create carrier service
        const response = await axios.post(
          `https://${session.shop}/admin/api/${API_VERSION}/carrier_services.json`,
          carrierService,
          {
            headers: {
              "X-Shopify-Access-Token": session.accessToken,
              "Content-Type": "application/json",
            },
          }
        );
        carrierServiceId = response.data.carrier_service.id.toString();
      }

      // save config
      await prisma.shopConfig.upsert({
        where: { shop: session.shop },
        update: { enabled, endpoint, apiKey, carrierServiceId },
        create: {
          shop: session.shop,
          enabled,
          endpoint,
          apiKey,
          carrierServiceId,
        },
      });
    } else {
      // Disable → Delete carrier service completely
      const existing = await prisma.shopConfig.findUnique({
        where: { shop: session.shop },
      });

      if (existing?.carrierServiceId) {
        try {
          await axios.delete(
            `https://${session.shop}/admin/api/${API_VERSION}/carrier_services/${existing.carrierServiceId}.json`,
            {
              headers: {
                "X-Shopify-Access-Token": session.accessToken,
                "Content-Type": "application/json",
              },
            }
          );
          console.log("✅ Carrier service deleted");
        } catch (err: any) {
          console.error("❌ Error deleting carrier service:", err.response?.data || err.message);
        }
      }

      // update DB with disabled status
      await prisma.shopConfig.upsert({
        where: { shop: session.shop },
        update: { enabled: false, endpoint, apiKey, carrierServiceId: null },
        create: {
          shop: session.shop,
          enabled: false,
          endpoint,
          apiKey,
          carrierServiceId: null,
        },
      });
    }

    return json({ ok: true });
  } catch (error: any) {
    console.error("❌ Error saving config:", error.response?.data || error.message);
    return json({ ok: false, error: error.message }, { status: 500 });
  }
}

export default function Index() {
  const { shopConfig } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [enabled, setEnabled] = useState(shopConfig?.enabled || false);
  const [endpoint, setEndpoint] = useState(shopConfig?.endpoint || "");
  const [apiKey, setApiKey] = useState(shopConfig?.apiKey || "");

  const isSubmitting = navigation.state === "submitting";

  const handleToggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setEndpoint(shopConfig?.endpoint || "");
      setApiKey(shopConfig?.apiKey || "");
    }
  }, [enabled, shopConfig]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">R8Connect Settings</h1>
      <Form method="post" className="space-y-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={handleToggle}
          />
          <span>Enable Carrier Service</span>
        </label>

        <div>
          <label className="block">Endpoint</label>
          <input
            type="text"
            name="endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>

        <div>
          <label className="block">API Key</label>
          <input
            type="text"
            name="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
      </Form>
    </div>
  );
}
