// // app/services/webhooks.ts
// import axios from "axios";

// const API_VERSION = "2025-07";

// const requiredTopics = [
//   "orders/create",
//   "orders/updated",
// ];

// export async function ensureWebhooks(token: string, shop: string) {
//   try {
//     const existing = await axios.get(`https://${shop}/admin/api/${API_VERSION}/webhooks.json`, {
//       headers: { "X-Shopify-Access-Token": token }
//     });

//     const existingTopics = new Set(existing.data.webhooks.map((w: any) => w.topic));

//     for (const topic of requiredTopics) {
//       if (!existingTopics.has(topic)) {
//         await axios.post(`https://${shop}/admin/api/${API_VERSION}/webhooks.json`, {
//           webhook: {
//             topic,
//             address: `https://${shop}/api/webhooks/${topic.replace("/", "_")}`,
//             format: "json"
//           }
//         }, {
//           headers: { "X-Shopify-Access-Token": token }
//         });
//       }
//     }
//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : String(error);
//     throw new Error(`Failed to ensure webhooks: ${errorMessage}`);
//   }
// }
