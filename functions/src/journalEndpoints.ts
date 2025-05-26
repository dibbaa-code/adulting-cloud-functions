/**
 * Journal-related HTTP-triggered Cloud Functions
 */
import {onCall, HttpsOptions} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// API key for authentication
const API_KEY = process.env.JOURNAL_API_KEY || "";

/**
 * HTTP function configuration
 */
const httpsOptions: HttpsOptions = {
  cors: true, // Enable CORS for all origins
  maxInstances: 10,
};

/**
 * HTTP-triggered function that saves a user journal entry
 * This can be called from external services via HTTPS
 */
export const saveJournalEntry = onCall(httpsOptions, async (request) => {
  try {
    // Log the request data
    logger.info("Received journal entry data", request.data);
    
    // Validate API key
    const providedApiKey = request.data?.apiKey;
    if (!providedApiKey || providedApiKey !== API_KEY) {
      logger.warn("Unauthorized access attempt", {
        ip: request.rawRequest.ip,
        headers: request.rawRequest.headers,
      });
      return {
        success: false,
        error: "Unauthorized: Invalid or missing API key",
        code: 401
      };
    }
    
    // Remove API key from data before processing
    const { apiKey, ...dataToProcess } = request.data;
    
    // Here you would process the journal entry data
    // This is an empty implementation that just acknowledges receipt
    
    // Return a success response
    return {
      success: true,
      message: "Journal entry saved successfully",
      timestamp: new Date().toISOString(),
      receivedData: dataToProcess, // Use the data without the API key
    };
  } catch (error) {
    // Log and return error
    logger.error("Error in saveJournalEntry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
});
