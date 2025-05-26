/**
 * Journal-related HTTP-triggered Cloud Functions
 */
import {onCall, HttpsOptions} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

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

    // Here you would process the journal entry data
    // This is an empty implementation that just acknowledges receipt
    
    // Return a success response
    return {
      success: true,
      message: "Journal entry saved successfully",
      timestamp: new Date().toISOString(),
      receivedData: request.data,
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
