import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();
export default prisma;

export async function upsertShopConfig(shop: string, enabled: boolean, endpoint: string, apiKey: string, carrierServiceId?: string) {
  const query = `
    INSERT INTO "ShopConfig" 
        (shop, enabled, endpoint, apiKey, carrierServiceId, updatedAt)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (shop)
    DO UPDATE SET 
        enabled = EXCLUDED.enabled,
        endpoint = EXCLUDED.endpoint,
        apiKey = EXCLUDED.apiKey,
        carrierServiceId = EXCLUDED.carrierServiceId,
        updatedAt = NOW();
  `;
  await prisma.$executeRawUnsafe(query, shop, enabled, endpoint, apiKey, carrierServiceId ?? null);
}