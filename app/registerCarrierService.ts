// registerCarrierService.ts
import axios from "axios";

const API_VERSION = "2025-07";
const CARRIER_NAME = "R8 Connect Rates"; // consistent name

export async function registerCarrierService(
  session: { shop: string; accessToken: string },
  endpoint: string,
  apiKey: string
): Promise<string> {
  const callbackUrl = `${endpoint}/${apiKey}`;

  try {
    // 1. Get existing carrier services
    const existing = await axios.get(
      `https://${session.shop}/admin/api/${API_VERSION}/carrier_services.json`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
      }
    );

    const carriers = existing.data.carrier_services || [];

    // 2. Check if our carrier already exists
    const existingCarrier = carriers.find(
      (carrier: any) =>
        carrier.name === CARRIER_NAME ||
        carrier.callback_url === callbackUrl
    );

    if (existingCarrier) {
      // 3. Update it instead of creating a duplicate
      console.log(`♻️ Updating existing carrier service: ${existingCarrier.id}`);

      await axios.put(
        `https://${session.shop}/admin/api/${API_VERSION}/carrier_services/${existingCarrier.id}.json`,
        {
          carrier_service: {
            name: CARRIER_NAME,
            callback_url: callbackUrl,
            service_discovery: true,
            format: "json",
            active: true,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken,
          },
        }
      );

      return existingCarrier.id;
    }

    // 4. Otherwise → create new
    console.log("➕ Creating new carrier service...");

    const response = await axios.post(
      `https://${session.shop}/admin/api/${API_VERSION}/carrier_services.json`,
      {
        carrier_service: {
          name: CARRIER_NAME,
          callback_url: callbackUrl,
          service_discovery: true,
          format: "json",
          active: true,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
      }
    );

    console.log("✅ Carrier service created:", response.data);
    return response.data.carrier_service.id;
  } catch (error: any) {
    console.error("❌ Carrier service error:", error.response?.data || error.message);
    throw error;
  }
}
