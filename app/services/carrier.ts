// app/services/carrier.ts
import axios from "axios";


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

export async function handleCarrierService(
  token: string, 
  shop: string, 
  endpoint: string, 
  apiKey: string,
  enabled: boolean 
  
): Promise<string> {

    if (!enabled) {
    console.log("Carrier service disabled — skipping registration");
    return "";
  }
  // Use the callback URL format from your working code
  const callbackUrl = `${endpoint}/api/Integration/shopify/${apiKey}`;
  
  console.log("🚀 Starting carrier service handling...");
  console.log("🏪 Shop:", shop);
  console.log("🔗 Callback URL:", callbackUrl);
  console.log("🔑 Token exists:", !!token);
  console.log("🔑 Token length:", token?.length || 0);
  
  try {
    const existingCarriers = await getCarrierServices(token, shop);
    
    // First, look for any R8Connect carriers (including ones with unique names)
    const r8ConnectCarriers = existingCarriers.filter(
      carrier => carrier.name.startsWith("R8Connect Shipping Rates")
    );
    
    console.log(`📋 Found ${r8ConnectCarriers.length} R8Connect carrier(s)`);
    
    // Try to update each R8Connect carrier until we find one we can modify
    for (const carrier of r8ConnectCarriers) {
      console.log(`📝 Attempting to update carrier: ${carrier.name} (ID: ${carrier.id})`);
      try {
        await updateExistingCarrierService(token, shop, carrier.id, callbackUrl, enabled);
        console.log(`✅ Successfully updated carrier: ${carrier.name}`);
        return String(carrier.id);
      } catch (updateError: any) {
        if (updateError instanceof axios.AxiosError && updateError.response?.status === 403) {
          console.log(`❌ Cannot update carrier ${carrier.name} (not created by this app)`);
          continue; // Try the next carrier
        } else {
          throw updateError;
        }
      }
    }
    
    // If we get here, either no R8Connect carriers exist or none can be updated
    // Check if we have any carriers with our callback URL (owned by us)
    const ownedCarrier = existingCarriers.find(
      carrier => carrier.callback_url === callbackUrl
    );
    
    if (ownedCarrier) {
      console.log(`✅ Found carrier with our callback URL: ${ownedCarrier.name} (ID: ${ownedCarrier.id})`);
      return String(ownedCarrier.id);
    }
    
    // No suitable carrier found, create a new one
    console.log("➕ Creating new carrier service...");
    const newCarrierId = await createCarrierService(token, shop, callbackUrl, enabled);
    return newCarrierId;
    
  } catch (error: unknown) {
    // Enhanced error handling for debugging
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
        // Handle callback URL already configured error
        const baseErrors = responseData.errors.base;
        if (baseErrors.some((err: string) => err.includes("already configured"))) {
          console.log("🔍 Callback URL conflict detected, searching for existing carrier...");
          
          // Find the carrier that has our callback URL
          const existingCarriers = await getCarrierServices(token, shop);
          const conflictingCarrier = existingCarriers.find(
            carrier => carrier.callback_url === callbackUrl
          );
          
          if (conflictingCarrier) {
            console.log(`✅ Found existing carrier with our callback URL: ${conflictingCarrier.name}`);
            return String(conflictingCarrier.id);
          }
        }
      }
      
      if (status === 403) {
        let errorMessage = "❌ CARRIER SERVICE ACCESS DENIED (403)";
        errorMessage += "\n\n🔍 TROUBLESHOOTING STEPS:";
        errorMessage += "\n1. Verify this is actually a development store";
        errorMessage += "\n2. Check if store has 'Calculated shipping rates' feature enabled";
        errorMessage += "\n3. Try creating a fresh development store";
        errorMessage += "\n4. Ensure app has write_shipping scope (✅ you have this)";
        
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
          errorMessage += `\n\n📨 Shopify Response: ${JSON.stringify(responseData)}`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Generic error for other status codes
      let errorMessage = `❌ SHOPIFY API ERROR (${status}): ${statusText}`;
      if (responseData) {
        errorMessage += `\n\n📨 Response Details: ${JSON.stringify(responseData, null, 2)}`;
      }
      throw new Error(errorMessage);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`❌ UNEXPECTED ERROR: ${errorMessage}`);
  }
}

async function getCarrierServices(token: string, shop: string): Promise<CarrierService[]> {
  try {
    const response = await axios.get<CarrierServicesResponse>(
      `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );
    
    console.log("✅ Successfully retrieved carrier services");
    console.log("📋 Existing carrier services:", response.data.carrier_services.map(cs => ({
      id: cs.id,
      name: cs.name,
      active: cs.active
    })));
    
    return response.data.carrier_services;
  } catch (error: unknown) {
    if (error instanceof axios.AxiosError) {
      console.log("❌ Error getting carrier services:");
      console.log("Status:", error.response?.status);
      console.log("Response:", JSON.stringify(error.response?.data, null, 2));
    }
    throw error;
  }
}

async function updateExistingCarrierService(
  token: string, 
  shop: string, 
  carrierId: string, 
  callbackUrl: string,
  enabled: boolean
  
): Promise<void> {
  const updateUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services/${carrierId}.json`;
  
  console.log("🔄 Updating existing carrier service...");
  console.log("📍 URL:", updateUrl);
  console.log("🆔 Carrier ID:", carrierId);
  console.log("🔗 New callback URL:", callbackUrl);
  console.log("🔛 Active status:", enabled);
  
  try {
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
    
    console.log("✅ Carrier service updated successfully");
  } catch (error: unknown) {
    if (error instanceof axios.AxiosError) {
      console.log("❌ Error updating carrier service:");
      console.log("Status:", error.response?.status);
      console.log("Response:", JSON.stringify(error.response?.data, null, 2));
      console.log("Request payload:", JSON.stringify({
        carrier_service: {
          active: true,
          callback_url: callbackUrl,
        },
      }, null, 2));
    }
    throw error;
  }
}

async function createCarrierService(
  token: string, 
  shop: string, 
  callbackUrl: string,
  enabled: boolean
): Promise<string> {
  return createCarrierServiceWithName(token, shop, callbackUrl, CARRIER_NAME , enabled);
}

async function createCarrierServiceWithName(
  token: string, 
  shop: string, 
  callbackUrl: string,
  name: string,
  enabled: boolean
): Promise<string> {
  const createUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services.json`;
  
  console.log("🔄 Creating new carrier service...");
  console.log("📍 URL:", createUrl);
  console.log("🔗 Callback URL:", callbackUrl);
  console.log("📛 Name:", name);
  console.log("🔛 Active status:", enabled);
  
  try {
    const response = await axios.post(
      createUrl,
      {
        credentials: "include",
        carrier_service: {
          name: name,
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
    
    console.log("✅ Carrier service created successfully");
    console.log("🆔 New carrier service ID:", response.data.carrier_service.id);
    
    // Ensure the ID is returned as a string for Prisma
    return String(response.data.carrier_service.id);
  } catch (error: unknown) {
    if (error instanceof axios.AxiosError) {
      console.log("❌ Error creating carrier service:");
      console.log("Status:", error.response?.status);
      console.log("Response:", JSON.stringify(error.response?.data, null, 2));
      console.log("Request payload:", JSON.stringify({
        carrier_service: {
          name: name,
          callback_url: callbackUrl,
          service_discovery: true,
          format: "json",
          active: enabled,
        },
      }, null, 2));
    }
    throw error;
  }
}

// async function deleteCarrierService(
//   token: string,
//   shop: string,
//   carrierId: string
// ): Promise<void> {
//   const deleteUrl = `https://${shop}/admin/api/${API_VERSION}/carrier_services/${carrierId}.json`;
  
//   console.log("🗑️ Attempting to delete carrier service...");
//   console.log("📍 URL:", deleteUrl);
//   console.log("🆔 Carrier ID:", carrierId);
  
//   try {
//     await axios.delete(deleteUrl, {
//       headers: {
//         "X-Shopify-Access-Token": token,
//         "Content-Type": "application/json",
//       },
//     });
    
//     console.log("✅ Carrier service deleted successfully");
//   } catch (error: unknown) {
//     if (error instanceof axios.AxiosError) {
//       console.log("❌ Error deleting carrier service:");
//       console.log("Status:", error.response?.status);
//       console.log("Response:", JSON.stringify(error.response?.data, null, 2));
//     }
//     throw error;
//   }
// }

// Legacy functions - keeping for backward compatibility
export async function registerCarrierService(token: string, shop: string,enabled:boolean, endpoint: string, apiKey: string): Promise<string> {
  return handleCarrierService(token, shop, endpoint, apiKey, enabled);
}

export async function updateCarrierService(token: string, shop: string, endpoint: string,apiKey: string, serviceId: string, enabled: boolean): Promise<string> {
  const callbackUrl = `${endpoint}/api/Integration/shopify/${apiKey}`;
  await updateExistingCarrierService(token, shop, serviceId, callbackUrl, enabled);
  return String(serviceId);
}