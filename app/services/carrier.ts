// app/services/carrier.ts
import { registerCarrierService } from "../registerCarrierService";
import { upsertCarrierService } from "../updateCarrierService";

const CARRIER_NAME = "R8Connect Shipping Rates";

export async function handleCarrierService(opts: {
  shop: string;
  accessToken: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
}): Promise<string> {
  const { shop, accessToken, endpoint, apiKey, enabled } = opts;

  if (!enabled) {
    console.log("Carrier disabled — skipping registration");
    return "";
  }

  console.log("🚀 Carrier handle:", { shop, endpoint });

  // Instead of rolling our own GET + PUT logic,
  // delegate to the upsert function
  try {
    const carrierId = await upsertCarrierService(
      { shop, accessToken },
      endpoint,
      apiKey,
      enabled
    );

    console.log("✅ Carrier handled via upsert:", carrierId);
    return carrierId;
  } catch (err: any) {
    console.error("❌ Upsert failed, falling back to register:", err.message);

    // if upsert fails, force create
    const carrierId = await registerCarrierService(
      { shop, accessToken },
      endpoint,
      apiKey
    );
    console.log("✅ Carrier registered via fallback:", carrierId);
    return carrierId;
  }
}
