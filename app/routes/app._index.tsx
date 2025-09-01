// app/routes/_index.tsx
import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Checkbox, TextField, Button, InlineStack, Banner } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { prisma, upsertShopConfig } from "../db.server";
import { handleCarrierService } from "../services/carrier";
import axios from "axios";

const API_VERSION = "2025-07";

interface SettingsData {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  accessToken: string;
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
    accessToken: session.accessToken!, // always fresh
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop!;
  const accessToken = session.accessToken!;
  const form = await request.formData();

  const enabled = form.get("enabled") === "on";
  const endpoint = String(form.get("endpoint") ?? "").trim();
  const apiKey = String(form.get("apiKey") ?? "").trim();

  const errors: Record<string, string> = {};
  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    errors.endpoint = "Endpoint must be a valid URL (http/https).";
  }
  if (Object.keys(errors).length) {
    return json<ActionResponse>({ ok: false, errors }, { status: 400 });
  }

  // Persist config first (without carrier id yet)
  await upsertShopConfig({ shop, enabled, endpoint, apiKey });

  let carrierError: string | undefined;

  try {
    if (enabled && endpoint && apiKey) {
      // quick auth sanity check (catches 401 early)
      const shopResp = await axios.get(`https://${shop}/admin/api/${API_VERSION}/shop.json`, {
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      });
      console.log("✅ Auth OK. Plan:", shopResp.data?.shop?.plan_name);

      const carrierServiceId = await handleCarrierService({
        shop,
        accessToken,         // <-- fresh token, never from DB
        endpoint,
        apiKey,
        enabled,
      });

      // save the created/updated carrier ID
      await upsertShopConfig({ shop, enabled, endpoint, apiKey, carrierServiceId });
    } 
  } catch (e: any) {
    console.error("❌ Carrier op failed:", e.response?.data || e.message);
    carrierError = e.message || "Carrier operation failed";
  }

  const payload: ActionResponse = {
    ok: !carrierError,
    settings: { enabled, endpoint, apiKey, accessToken },
    ...(carrierError ? { errors: { carrierService: carrierError } } : {}),
  };

  return json(payload, { status: carrierError ? 400 : 200 });
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
    setCarrierServiceError(fetcher.data.errors?.carrierService);
    if (fetcher.data.ok) {
      setCarrierServiceSuccess(true);
      shopify.toast.show("Settings saved.");
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
            <div style={{ padding: 20, maxWidth: 520 }}>
              <Text as="h2" variant="headingLg">R8Connect</Text>
              <Text as="p" tone="subdued">Rating Engine for Custom Shipping</Text>

              {carrierServiceSuccess && (
                <Banner tone="success" onDismiss={() => setCarrierServiceSuccess(false)}>
                  Carrier settings updated.
                </Banner>
              )}
              {carrierServiceError && (
                <Banner tone="critical" onDismiss={() => setCarrierServiceError(undefined)}>
                  {carrierServiceError}
                </Banner>
              )}

              <Checkbox label="Enable" checked={enabled} onChange={setEnabled} />
              <div style={{ marginTop: 16 }}>
                <TextField label="Endpoint" value={endpoint} onChange={setEndpoint} autoComplete="off" />
              </div>
              <div style={{ marginTop: 16 }}>
                <TextField label="API Key" value={apiKey} onChange={setApiKey} type="password" autoComplete="off" />
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
