// app/services/carrier.ts
import axios from "axios";
import prisma from "../db.server"; // Supabase DB via Prisma

const API_VERSION = "2025-07";
const CARRIER_NAME = "R8Connect Shipping Rates"; // Match your working code

interface CarrierService {
  id: string;
  name: string;
  callback_url: string;
  active: boolean;
}

interface CarrierServicesResponse {
  carrier_services: CarrierService[];
}

// 🔑 Always fetch latest token from DB
async function getShopToken(shop: string): Promise<string> {
  const shopConfig = await prisma.shopConfig.findUnique({
    where: { shop },
  });

  if (!shopConfig?.apiKey) {
    throw new Error(`❌ No access token found for shop: ${shop}`);
  }

  return shopConfig.apiKey;
}

// Main function: register/update carrier service
export async function handleCarrierService(
  shop: string,
  endpoint: string,
  apiKey: string,
  enabled: boolean
): Promise<string> {
  if (!enabled) {
    console.log("Carrier service disabled — skipping registration");
    return "";
  }

  // ✅ Always fetch fresh token
  const token = await getShopToken(shop);

  const callbackUrl = `${endpoint}/api/Integration/shopify/${apiKey}`;

  console.log("🚀 Starting carrier service handling...");
  console.log("🏪 Shop:", shop);
  console.log("🔗 Callback URL:", callbackUrl);
  console.log("🔑 Token length:", token?.length || 0);

  try {
    // 1. Get all existing carrier services
    const existingCarriers = await getCarrierServices(token, shop);

    // 2. Look for any R8Connect carriers
    const r8ConnectCarriers = existingCarriers.filter((carrier) =>
      carrier.name.startsWith(CARRIER_NAME)
    );

    // Try updating existing carriers if they belong to our app
    for (const carrier of r8ConnectCarriers) {
      try {
        await updateExistingCarrierService(
          token,
          shop,
          carrier.id,
          callbackUrl,
          enabled
        );
        console.log(`✅ Updated carrier: ${carrier.name}`);
        return String(carrier.id);
      } catch (err: any) {
        if (
          err instanceof axios.AxiosError &&
          err.response?.status === 403
        ) {
          console.log(
            `❌ Cannot update carrier ${carrier.name} (not created by this app)`
          );
          continue;
        }
        throw err;
      }
    }

    // 3. If carrier exists with our callback URL, reuse it
    const ownedCarrier = existingCarriers.find(
      (carrier) => carrier.callback_url === callbackUrl
    );
    if (ownedCarrier) {
      console.log(
        `✅ Found carrier with our callback URL: ${ownedCarrier.name} (ID: ${ownedCarrier.id})`
      );
      return String(ownedCarrier.id);
    }

    // 4. If none found → create a new carrier
    console.log("➕ Creating new carrier service...");
    const newCarrierId = await createCarrierService(
      token,
      shop,
      callbackUrl,
      enabled
    );
    return newCarrierId;
  } catch (error: unknown) {
    handleCarrierError(error);
    throw error;
  }
}

//
// ========== HELPER FUNCTIONS ==========
//

async function getCarrierServices(
  token: string,
  shop: string
): Promise<CarrierService[]> {
  const response = await axios.get<CarrierServicesResponse>(
    `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
    {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.carrier_services;
}

async function updateExistingCarrierService(
  token: string,
  shop: string,
  carrierId: string,
  callbackUrl: string,
  enabled: boolean
): Promise<void> {
  const updateUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services/${carrierId}.json`;

  await axios.put(
    updateUrl,
    {
      credentials: "include",
      carrier_service: {
        active: enabled,
        callback_url: callbackUrl,
      },
    },
    {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    }
  );
}

async function createCarrierService(
  token: string,
  shop: string,
  callbackUrl: string,
  enabled: boolean
): Promise<string> {
  const createUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`;

  const response = await axios.post(
    createUrl,
    {
      credentials: "include",
      carrier_service: {
        name: CARRIER_NAME,
        callback_url: callbackUrl,
        service_discovery: true,
        format: "json",
        active: enabled,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
    }
  );

  return String(response.data.carrier_service.id);
}

function handleCarrierError(error: unknown) {
  if (error instanceof axios.AxiosError) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    console.error("❌ Carrier Service Error:", status, responseData);

    if (status === 401) {
      console.error("❌ AUTH FAILED: Token is invalid or expired");
    }
    if (status === 403) {
      console.error("❌ FORBIDDEN: Store plan may not support calculated rates");
    }
    if (status === 422) {
      console.error("❌ INVALID REQUEST: Callback URL already exists");
    }
  } else {
    console.error("❌ Unexpected error:", error);
  }
}

//
// ========== PUBLIC EXPORTS ==========
//

// Called on install/reinstall → ensures carrier service is registered
export async function registerCarrierService(
  shop: string,
  enabled: boolean,
  endpoint: string,
  apiKey: string
): Promise<string> {
  return handleCarrierService(shop, endpoint, apiKey, enabled);
}

// Update existing carrier service by ID
export async function updateCarrierService(
  shop: string,
  endpoint: string,
  apiKey: string,
  serviceId: string,
  enabled: boolean
): Promise<string> {
  const token = await getShopToken(shop);
  const callbackUrl = `${endpoint}/api/Integration/shopify/${apiKey}`;
  await updateExistingCarrierService(
    token,
    shop,
    serviceId,
    callbackUrl,
    enabled
  );
  return String(serviceId);
}
