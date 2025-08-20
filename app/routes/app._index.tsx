// app/routes/_index.tsx
import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Checkbox,
  TextField,
  Button,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { handleCarrierService } from "../services/carrier";
// import { ensureWebhooks } from "../services/webhooks";

import axios from "axios";

const API_VERSION = "2025-07";  

interface SettingsData {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  accessToken: string;
  testSession?: any;
}

interface ActionResponse {
  ok: boolean;
  errors?: Record<string, string>;
  settings?: SettingsData;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop!;

  const config = await prisma.shopConfig.findUnique({ where: { shop } });
  return json<SettingsData>({
    enabled: config?.enabled ?? false,
    endpoint: config?.endpoint ?? "",
    apiKey: config?.apiKey ?? "",
    accessToken: session.accessToken!,
    testSession: session,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop!;
  const form = await request.formData();

  // Debug session
  console.log("Debug - Session shop:", shop);
  console.log("Debug - Access token exists:", session.accessToken);
  console.log("Debug - Session scope:", session.scope);
  console.log("Debug - Has write_shipping scope:", session.scope?.includes('write_shipping'));
  console.log("Debug - Has read_shipping scope:", session.scope?.includes('read_shipping'));

  const enabled = form.get("enabled") === "on";
  const endpoint = (form.get("endpoint") as string)?.trim();
  const apiKey = (form.get("apiKey") as string)?.trim();

  const errors: Record<string, string> = {};
  if (endpoint && !/^https?:\/\//.test(endpoint)) {
    errors.endpoint = "Endpoint must be a valid URL.";
  }

  // Check if shipping scopes are present (temporarily disabled for testing)
  if (enabled && !session.scope?.includes('write_shipping')) {
    console.warn("⚠️ WARNING: App missing write_shipping scope, but proceeding anyway for testing");
    // Temporarily comment out the error to test if carrier service works
    // errors.carrierService = "App missing write_shipping scope. Please reinstall the app.";
    // return json<ActionResponse>({ ok: false, errors }, { status: 400 });
  }

  if (Object.keys(errors).length) {
    return json<ActionResponse>({ ok: false, errors }, { status: 400 });
  }

  await prisma.shopConfig.upsert({
    where: { shop },
    update: { enabled, endpoint, apiKey },
    create: { shop, enabled, endpoint, apiKey },
  });

  let carrierError: string | undefined;
  try {
    if (enabled && endpoint && apiKey) {
      // Test authentication first with a simple API call
      try {
        const testResponse = await axios.get(`https://${shop}/admin/api/${API_VERSION}/shop.json`, {
          headers: {
            "X-Shopify-Access-Token": session.accessToken!,
            "Content-Type": "application/json",
          },
        });
        console.log("✅ Authentication test passed - shop API works");
        
        // Log store plan information
        const shopData = testResponse.data.shop;
        console.log("🏪 Store Plan:", shopData.plan_name);
        console.log("🏪 Store Plan Display Name:", shopData.plan_display_name);
        console.log("🏪 Store Domain:", shopData.domain);
        
      } catch (authTestError: any) {
        console.log("❌ Authentication test failed:", authTestError.response?.status, authTestError.response?.statusText);
        throw new Error(`Authentication test failed: ${authTestError.response?.status} - Check access token and shop domain`);
      }

      const serviceId = await handleCarrierService(session.accessToken!, shop, endpoint, apiKey,enabled);
      await prisma.shopConfig.update({ where: { shop }, data: { carrierServiceId: serviceId } });
      // await ensureWebhooks(session.accessToken!, shop);
    }
     else if (!enabled) {
  const config = await prisma.shopConfig.findUnique({ where: { shop } });
  if (config?.carrierServiceId) {
    try {
      await axios.put(
        `https://${shop}/admin/api/${API_VERSION}/carrier_services/${config.carrierServiceId}.json`,
        { carrier_service: { active: false } },
        {
          headers: {
            "X-Shopify-Access-Token": session.accessToken!,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("✅ Carrier service deactivated.");
    } catch (deactivateError: any) {
      carrierError = `Failed to deactivate: ${deactivateError.message}`;
    }
  }
}
  } catch (e: any) {
    carrierError = e.message;
  }

  const response: ActionResponse = {
    ok: true,
    settings: { enabled, endpoint, apiKey, accessToken: session.accessToken! },
  };
  if (carrierError) response.errors = { carrierService: carrierError };

  return json(response);
};

export default function Index() {
  const loaderSettings = useLoaderData<SettingsData>();
  const fetcher = useFetcher<ActionResponse>();
  const shopify = useAppBridge();

  const [enabled, setEnabled] = useState(loaderSettings.enabled);
  const [endpoint, setEndpoint] = useState(loaderSettings.endpoint);
  const [apiKey, setApiKey] = useState(loaderSettings.apiKey);
  const [carrierServiceError, setCarrierServiceError] = useState<string | undefined>();
  const [carrierServiceSuccess, setCarrierServiceSuccess] = useState(false);

  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.settings) {
      setEnabled(fetcher.data.settings.enabled);
      setEndpoint(fetcher.data.settings.endpoint);
      setApiKey(fetcher.data.settings.apiKey);
    }

    setCarrierServiceError(fetcher.data.errors?.carrierService);

    if (fetcher.data.ok) {
      setCarrierServiceSuccess(true);
      shopify.toast.show("Settings saved and carrier service updated.");
    }
  }, [fetcher.data, shopify]);

  const save = useCallback(() => {
    const fd = new FormData();
    fd.append("enabled", enabled ? "on" : "");
    fd.append("endpoint", endpoint);
    fd.append("apiKey", apiKey);
    fetcher.submit(fd, { method: "POST" });
  }, [fetcher, enabled, endpoint, apiKey]);

  return (
    <Page>
      <TitleBar title="R8Connect" />
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: 20, maxWidth: 480 }}>
              <Text as="h2" variant="headingLg">R8Connect</Text>
              <Text as="p" tone="subdued">Rating Engine for Custom Shipping</Text>

              {carrierServiceSuccess && (
                <Banner tone="success" onDismiss={() => setCarrierServiceSuccess(false)}>
                  Carrier service registered successfully!
                </Banner>
              )}

              {carrierServiceError && (
                <Banner tone="critical" onDismiss={() => setCarrierServiceError(undefined)}>
                  {carrierServiceError}
                </Banner>
              )}

              <Checkbox label="Enable" checked={enabled} onChange={setEnabled} />
              <div style={{ marginTop: 16 }}>
                <TextField
                  label="Endpoint"
                  value={endpoint}
                  onChange={setEndpoint}
                  autoComplete="off"
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <TextField
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                  type="password"
                  autoComplete="off"
                />
              </div>
              <div style={{ marginTop: 24 }}>
                <InlineStack align="start">
                  <Button variant="primary" onClick={save} loading={fetcher.state !== "idle"}>
                    Save changes
                  </Button>
                </InlineStack>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
