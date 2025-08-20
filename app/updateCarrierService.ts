// app/updateCarrierService.ts



const API_VERSION = "2025-07"; // Use latest or as needed

export async function updateCarrierService(
  session: { shop: string; accessToken: string },
  endpoint: string,
  apiKey: string,
  enabled: boolean 
): Promise<void> {
  const { shop, accessToken } = session;

  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  };
    console.log("1");
  // Get existing carrier services
  const existingResponse = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
    { headers }
  );
    console.log("2");
  const existingData = await existingResponse.json();
  const existingCarrier = existingData.carrier_services?.find(
    (cs: any) => cs.name === "R8Connect Shipping Rates"
  );
   console.log("3");
  if (!existingCarrier) {
    console.warn("⚠️ No existing carrier service found to update.");
    return;
  }

  const carrierServiceId = existingCarrier.id;

  // ✅ Construct callback URL
  const callback_url = `${endpoint}/api/Integration/shopify/${apiKey}`;

  // ✅ Construct full PUT endpoint
  const carrierUpdateUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services/${carrierServiceId}.json`;

  // ✅ Log the values as you marked in screenshot
  console.log("🔸 Shopify PUT Endpoint Hit:");
  console.log(carrierUpdateUrl);

  console.log("🔸 Callback URL being set:");
  console.log(callback_url);
  console.log("🔸 Enabled status being set:");
  console.log(enabled);

  const body = {
    carrier_service: {
      active: enabled,
      callback_url,
    },
  };
   console.log("5");
  const updateResponse = await fetch(carrierUpdateUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
   console.log("6");
  const responseText = await updateResponse.text();

  if (!updateResponse.ok) {
    console.error("❌ Failed to update carrier service:", responseText);
    throw new Error(`Carrier service update failed: ${responseText}`);
  }

  console.log("✅ Carrier service updated successfully.");
}
