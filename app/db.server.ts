import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? [] : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

// ---------- DB helpers ----------
export async function clearShopData(shop: string) {
  try {
    await prisma.$transaction([
      prisma.shopConfig.deleteMany({ where: { shop } }),
      prisma.session.deleteMany({ where: { shop } }),
    ]);
  } catch (err) {
    console.error(`❌ Error while deleting data for shop=${shop}`, err);
    throw err;
  }
}


// export async function upsertShopConfig(opts: {
//   shop: string;
//   enabled: boolean;
//   endpoint: string;
//   apiKey: string;
//   carrierServiceId?: string | null;
// }) {
//   const { shop, enabled, endpoint, apiKey, carrierServiceId = null } = opts;

//   return prisma.shopConfig.upsert({
//     where: { shop },
//     update: {
//       enabled,
//       endpoint,
//       apiKey,
//       carrierServiceId: carrierServiceId ? String(carrierServiceId) : null, // ✅ cast to string
//       updatedAt: new Date(),
//     },
//     create: {
//       shop,
//       enabled,
//       endpoint,
//       apiKey,
//       carrierServiceId: carrierServiceId ? String(carrierServiceId) : null, // ✅ cast to string
//     },
//   });
// }
export async function upsertShopConfig({
  shop,
  enabled,
  endpoint,
  apiKey,
  carrierServiceId,
}: {
  shop: string;
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  carrierServiceId?: string | null;
}) {
  const existing = await prisma.shopConfig.findUnique({ where: { shop } });

  return prisma.shopConfig.upsert({
    where: { shop },
    update: {
      enabled,
      endpoint,
      apiKey,
      // ✅ only overwrite if explicitly provided
      ...(carrierServiceId !== undefined ? { carrierServiceId } : {}),
    },
    create: {
      shop,
      enabled,
      endpoint,
      apiKey,
      carrierServiceId: carrierServiceId ?? null,
    },
  });
}
