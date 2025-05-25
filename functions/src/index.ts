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

    // Parse the time format like "8:00 AM"
    const scheduledTime = parseTimeString(callTime);

    // Ensure the time is valid
    if (!scheduledTime || isNaN(scheduledTime.getTime())) {
      logger.error(`Invalid call time format: ${callTime}`);
      return;
    }

    logger.info(
      `Parsed time for ${callType} call: ${scheduledTime.toISOString()}`,
    );

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

/**
 * Parse a time string in format "8:00 AM" to a Date object
 * @param {string} timeString - Time string in format "8:00 AM"
 * @return {Date|null} Date object set to today with the specified time
 */
function parseTimeString(timeString: string): Date | null {
  try {
    // Check if the string matches the expected format
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = timeString.match(timeRegex);

    if (!match) {
      logger.error(`Time string does not match expected format: ${timeString}`);
      return null;
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    // Convert to 24-hour format
    if (period === "PM" && hours < 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    // Create a date object for today with the specified time
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    // If the time is already past for today, schedule it for tomorrow
    const now = new Date();
    if (date < now) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  } catch (error) {
    logger.error(`Error parsing time string: ${timeString}`, error);
    return null;
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

