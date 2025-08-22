// app/services/carrier.ts
import axios from "axios";
import prisma from "../db.server"; // ✅ added

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

// 🔑 Always fetch the latest token from DB before calling Shopify APIs
async function getShopToken(shop: string): Promise<string> {
  const shopConfig = await prisma.shopConfig.findUnique({
    where: { shop },
  });

  if (!shopConfig?.apiKey) {
    throw new Error(`❌ No API key/token found for shop: ${shop}`);
  }

  return shopConfig.apiKey;
}

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

  // ✅ pull fresh token every time
  const token = await getShopToken(shop);

  const callbackUrl = `${endpoint}/api/Integration/shopify/${apiKey}`;

  console.log("🚀 Starting carrier service handling...");
  console.log("🏪 Shop:", shop);
  console.log("🔗 Callback URL:", callbackUrl);
  console.log("🔑 Token exists:", !!token);
  console.log("🔑 Token length:", token?.length || 0);

  try {
    const existingCarriers = await getCarrierServices(token, shop);

    const r8ConnectCarriers = existingCarriers.filter((carrier) =>
      carrier.name.startsWith("R8Connect Shipping Rates")
    );

    console.log(`📋 Found ${r8ConnectCarriers.length} R8Connect carrier(s)`);

    for (const carrier of r8ConnectCarriers) {
      console.log(
        `📝 Attempting to update carrier: ${carrier.name} (ID: ${carrier.id})`
      );
      try {
        await updateExistingCarrierService(
          token,
          shop,
          carrier.id,
          callbackUrl,
          enabled
        );
        console.log(`✅ Successfully updated carrier: ${carrier.name}`);
        return String(carrier.id);
      } catch (updateError: any) {
        if (
          updateError instanceof axios.AxiosError &&
          updateError.response?.status === 403
        ) {
          console.log(
            `❌ Cannot update carrier ${carrier.name} (not created by this app)`
          );
          continue;
        } else {
          throw updateError;
        }
      }
    }

    const ownedCarrier = existingCarriers.find(
      (carrier) => carrier.callback_url === callbackUrl
    );

    if (ownedCarrier) {
      console.log(
        `✅ Found carrier with our callback URL: ${ownedCarrier.name} (ID: ${ownedCarrier.id})`
      );
      return String(ownedCarrier.id);
    }

    console.log("➕ Creating new carrier service...");
    const newCarrierId = await createCarrierService(
      token,
      shop,
      callbackUrl,
      enabled
    );
    return newCarrierId;
  } catch (error: unknown) {
    if (error instanceof axios.AxiosError) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseData = error.response?.data;

      console.log("❌ Axios Error Details:");
      console.log("Status:", status);
      console.log("Status Text:", statusText);
      console.log("Response Data:", JSON.stringify(responseData, null, 2));
      console.log("Request URL:", error.config?.url);
      console.log("Request Method:", error.config?.method);

      if (status === 422 && responseData?.errors?.base) {
        const baseErrors = responseData.errors.base;
        if (
          baseErrors.some((err: string) =>
            err.includes("already configured")
          )
        ) {
          console.log(
            "🔍 Callback URL conflict detected, searching for existing carrier..."
          );

          const existingCarriers = await getCarrierServices(token, shop);
          const conflictingCarrier = existingCarriers.find(
            (carrier) => carrier.callback_url === callbackUrl
          );

          if (conflictingCarrier) {
            console.log(
              `✅ Found existing carrier with our callback URL: ${conflictingCarrier.name}`
            );
            return String(conflictingCarrier.id);
          }
        }
      }

      if (status === 403) {
        let errorMessage = "❌ CARRIER SERVICE ACCESS DENIED (403)";
        errorMessage += "\n\n🔍 TROUBLESHOOTING STEPS:";
        errorMessage += "\n1. Verify this is actually a development store";
        errorMessage +=
          "\n2. Check if store has 'Calculated shipping rates' feature enabled";
        errorMessage += "\n3. Try creating a fresh development store";
        errorMessage +=
          "\n4. Ensure app has write_shipping scope (✅ you have this)";

        if (responseData?.errors) {
          errorMessage += `\n\n📨 Shopify Error Details:`;
          if (Array.isArray(responseData.errors)) {
            responseData.errors.forEach((err: string, index: number) => {
              errorMessage += `\n   ${index + 1}. ${err}`;
            });
          } else {
            errorMessage += `\n   ${JSON.stringify(responseData.errors)}`;
          }
        }

        throw new Error(errorMessage);
      }

      if (status === 401) {
        let errorMessage = "❌ AUTHENTICATION FAILED (401)";
        errorMessage += "\n\n🔍 POSSIBLE CAUSES:";
        errorMessage += "\n1. Access token is invalid or expired";
        errorMessage += "\n2. App needs to be reinstalled";
        errorMessage += "\n3. Session has expired";

        if (responseData) {
          errorMessage += `\n\n📨 Shopify Response: ${JSON.stringify(
            responseData
          )}`;
        }

        throw new Error(errorMessage);
      }

      let errorMessage = `❌ SHOPIFY API ERROR (${status}): ${statusText}`;
      if (responseData) {
        errorMessage += `\n\n📨 Response Details: ${JSON.stringify(
          responseData,
          null,
          2
        )}`;
      }
      throw new Error(errorMessage);
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);
    throw new Error(`❌ UNEXPECTED ERROR: ${errorMessage}`);
  }
}

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
  return createCarrierServiceWithName(
    token,
    shop,
    callbackUrl,
    CARRIER_NAME,
    enabled
  );
}

async function createCarrierServiceWithName(
  token: string,
  shop: string,
  callbackUrl: string,
  name: string,
  enabled: boolean
): Promise<string> {
  const createUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`;

  const response = await axios.post(
    createUrl,
    {
      credentials: "include",
      carrier_service: {
        name,
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

// Wrapper functions - unchanged functionality
export async function registerCarrierService(
  shop: string,
  enabled: boolean,
  endpoint: string,
  apiKey: string
): Promise<string> {
  return handleCarrierService(shop, endpoint, apiKey, enabled);
}

export async function updateCarrierService(
  shop: string,
  endpoint: string,
  apiKey: string,
  serviceId: string,
  enabled: boolean
): Promise<string> {
  const token = await getShopToken(shop); // ✅ fetch fresh token
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
