/**
 * Firebase Cloud Functions with Firestore document triggers
 * See full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Load environment variables from .env file during development
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
}

// Import the necessary trigger types from Firebase Functions v2
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import axios from "axios";

// ===== Vapi API Configuration =====
// Set this in your Firebase environment variables
const VAPI_API_KEY = process.env.VAPI_API_KEY || "";
const VAPI_API_URL = "https://api.vapi.ai/call/create";

/**
 * Schedule a call with Vapi API
 * @param {string} userId - The user ID
 * @param {string} phoneNumber - The phone number to call
 * @param {string} callTime - The time to schedule the call
 * @param {string} callType - Type of call (morning or evening)
 * @return {Promise<any>} The API response data
 */
async function scheduleVapiCall(
  userId: string,
  phoneNumber: string,
  callTime: string,
  callType: "morning" | "evening",
) {
  try {
    if (!VAPI_API_KEY) {
      logger.error("VAPI_API_KEY is not set in environment variables");
      return;
    }

    // Parse the callTime string to create a Date object for scheduling
    const scheduledTime = new Date(callTime);

    // Ensure the time is valid
    if (isNaN(scheduledTime.getTime())) {
      logger.error(`Invalid call time format: ${callTime}`);
      return;
    }

    // Prepare the request payload for Vapi API
    const payload = {
      type: "outboundPhoneCall",
      name: `${callType.charAt(0).toUpperCase() + callType.slice(1)} ` +
        `Call for User ${userId}`,
      // Set this in your Firebase environment variables
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: phoneNumber,
        name: `User ${userId}`,
      },
      schedulePlan: {
        earliestAt: scheduledTime.toISOString(),
        // Add 5 minutes buffer
        latestAt: new Date(scheduledTime.getTime() + 5 * 60000).toISOString(),
      },
    };

    // Make the API call to Vapi
    const response = await axios.post(VAPI_API_URL, payload, {
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    logger.info(
      `Successfully scheduled ${callType} call for user ${userId}`,
      response.data,
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Error scheduling ${callType} call for user ${userId}:`,
      error,
    );
    throw error;
  }
}

// ===== Firestore Triggers =====

/**
 * Firestore onCreate trigger - runs when a document is created
 * This example triggers when a new document is created in the 'users'
 * collection
 */
export const onNewUser = onDocumentCreated("users/{userId}", (event) => {
  const userId = event.params.userId;
  const userData = event.data?.data();

  logger.info(`New user created with ID: ${userId}`, userData);

  // You could perform actions like:
  // - Create default data in other collections
  // - Send welcome emails
  // - Update counters
  return null;
});

/**
 * Firestore onUpdate trigger - runs when a document is updated
 */
export const onUserUpdated = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    logger.info(
      `User ${userId} updated`,
      {before: beforeData, after: afterData},
    );

    // Check if morningCallTime or eveningCallTime has been updated
    const morningCallTimeChanged = beforeData?.morningCallTime !==
      afterData?.morningCallTime && afterData?.morningCallTime;
    const eveningCallTimeChanged = beforeData?.eveningCallTime !==
      afterData?.eveningCallTime && afterData?.eveningCallTime;

    // Get the user's phone number
    const phoneNumber = afterData?.phoneNumber;

    if (!phoneNumber) {
      logger.warn(
        `Cannot schedule calls for user ${userId}: No phone number found`,
      );
      return null;
    }

    try {
      // Schedule morning call if morningCallTime was updated
      if (morningCallTimeChanged) {
        await scheduleVapiCall(
          userId,
          phoneNumber,
          afterData.morningCallTime,
          "morning",
        );
        logger.info(
          `Scheduled morning call for user ${userId} at ` +
          `${afterData.morningCallTime}`,
        );
      }

      // Schedule evening call if eveningCallTime was updated
      if (eveningCallTimeChanged) {
        await scheduleVapiCall(
          userId,
          phoneNumber,
          afterData.eveningCallTime,
          "evening",
        );
        logger.info(
          `Scheduled evening call for user ${userId} at ` +
          `${afterData.eveningCallTime}`,
        );
      }
    } catch (error) {
      logger.error(`Error scheduling calls for user ${userId}:`, error);
    }

    return null;
  },
);

/**
 * Firestore onDelete trigger - runs when a document is deleted
 */
export const onUserDeleted = onDocumentDeleted(
  "users/{userId}",
  (event) => {
    const userId = event.params.userId;

    logger.info(`User ${userId} was deleted`);
    // Clean up related data
    return null;
  },
);

