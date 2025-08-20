//registerCarrierService.ts
import axios from "axios";

export async function registerCarrierService(
  session: { shop: string; accessToken: string },
  endpoint: string,
  apiKey: string
): Promise<string> {
  const callbackUrl = `${endpoint}/${apiKey}`;

  const response = await axios.post(
    `https://${session.shop}/admin/api/2025-07/carrier_services.json`,
    {
      carrier_service: {
        name: "R8 Connect Rates",
        callback_url: callbackUrl,
        service_discovery: true,
        format: "json",
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
}
