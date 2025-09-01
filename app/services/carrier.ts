// app/services/carrier.ts
import axios from "axios";

const API_VERSION = "2025-07";
const CARRIER_NAME = "R8Connect Shipping Rates";

interface CarrierService {
  id: string;
  name: string;
  callback_url: string;
  active: boolean;
}
interface CarrierServicesResponse {
  carrier_services: CarrierService[];
}

export async function handleCarrierService(opts: {
  shop: string;
  accessToken: string;       // <-- pass the fresh token in
  endpoint: string;
  apiKey: string;
  enabled: boolean;
}): Promise<string> {
  const { shop, accessToken, endpoint, apiKey, enabled } = opts;

  if (!enabled) {
    // Disable is handled separately in _index.tsx via DELETE
    console.log("Carrier disabled — skipping registration");
    return "";
  }

  const callbackUrl = `${endpoint}/api/Integration/shopify/${apiKey}`;
  console.log("🚀 Carrier handle:", { shop, callbackUrl });

  const existing = await getCarrierServices(accessToken, shop);

  // Update any of our carriers if present
  const ours = existing.filter((c) => c.name?.startsWith(CARRIER_NAME));
  for (const c of ours) {
    try {
      await updateExistingCarrierService(accessToken, shop, c.id, callbackUrl,enabled);
      console.log(`✅ Updated carrier ${c.id}`);
      return String(c.id);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        console.log(`❌ Not ours to update: ${c.id}`);
        continue;
      }
      throw err;
    }
  }

  // Reuse if same callback is already there
  const sameCb = existing.find((c) => c.callback_url === callbackUrl);
  if (sameCb) {
    console.log(`✅ Reusing carrier with same callback: ${sameCb.id}`);
    return String(sameCb.id);
  }

  // Create new
  console.log("➕ Creating carrier…");
  return await createCarrierService(accessToken, shop, callbackUrl,enabled);
}

// ---------- helpers ----------
async function getCarrierServices(accessToken: string, shop: string) {
  const r = await axios.get<CarrierServicesResponse>(
    `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
    { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
  );
  return r.data.carrier_services ?? [];
}

async function updateExistingCarrierService(
  accessToken: string,
  shop: string,
  carrierId: string,
  callbackUrl: string,
  active: boolean
) {
  await axios.put(
    `https://${shop}/admin/api/${API_VERSION}/carrier_services/${carrierId}.json`,
    {
      carrier_service: {
        callback_url: callbackUrl,
        service_discovery: true,
        format: "json",
        active: active, 
      },
    },
    { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
  );
}

async function createCarrierService(
  accessToken: string,
  shop: string,
  callbackUrl: string,
  active: boolean
): Promise<string> {
  const r = await axios.post(
    `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
    {
      carrier_service: {
        name: CARRIER_NAME,
        callback_url: callbackUrl,
        service_discovery: true,
        format: "json",
        active: active,
      },
    },
    { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
  );
  return String(r.data.carrier_service.id);
}
