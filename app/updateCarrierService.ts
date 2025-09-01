// app/updateCarrierService.ts
const API_VERSION = "2025-07"; // Use latest or as needed
const CARRIER_NAME = "R8Connect Shipping Rates";

export async function upsertCarrierService(
  session: { shop: string; accessToken: string },
  endpoint: string,
  apiKey: string,
  enabled: boolean
): Promise<string> {
  const { shop, accessToken } = session;

  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  };

  console.log("🔍 Checking for existing carrier services...");

  // 1. Get existing carrier services
  const existingResponse = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
    { headers }
  );

  if (!existingResponse.ok) {
    throw new Error(
      `Failed to fetch carrier services: ${await existingResponse.text()}`
    );
  }

  const existingData = await existingResponse.json();
  const existingCarrier = existingData.carrier_services?.find(
    (cs: any) => cs.name === CARRIER_NAME
  );

  // ✅ Construct callback URL
  const callback_url = `${endpoint}/api/Integration/shopify/${apiKey}`;

  if (existingCarrier) {
    // 2. Update existing carrier
    console.log(`♻️ Updating existing carrier service: ${existingCarrier.id}`);

    const carrierUpdateUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services/${existingCarrier.id}.json`;

    const body = {
      carrier_service: {
        name: CARRIER_NAME,
        active: enabled,
        callback_url,
        service_discovery: true,
        format: "json",
      },
    };

    const updateResponse = await fetch(carrierUpdateUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await updateResponse.text();
    if (!updateResponse.ok) {
      console.error("❌ Failed to update carrier service:", responseText);
      throw new Error(`Carrier service update failed: ${responseText}`);
    }

    console.log("✅ Carrier service updated successfully.");
    return String(existingCarrier.id);
  } else {
    // 3. Create new carrier service
    console.log("➕ Creating new carrier service...");

    const body = {
      carrier_service: {
        name: CARRIER_NAME,
        active: enabled,
        callback_url,
        service_discovery: true,
        format: "json",
      },
    };

    const createResponse = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const responseText = await createResponse.text();
    if (!createResponse.ok) {
      console.error("❌ Failed to create carrier service:", responseText);
      throw new Error(`Carrier service creation failed: ${responseText}`);
    }

    const created = JSON.parse(responseText);
    console.log("✅ Carrier service created:", created);

    return String(created.carrier_service.id);
  }
}
