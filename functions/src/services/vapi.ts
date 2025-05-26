/**
 * Vapi API service integration
 * Handles communication with the Vapi API for scheduling calls
 */
import * as logger from "firebase-functions/logger";
import {VapiClient} from "@vapi-ai/server-sdk";

// ===== Vapi API Configuration =====
// Set this in your Firebase environment variables
const VAPI_API_KEY = process.env.VAPI_API_KEY || "";

// Initialize the Vapi client
const vapiClient = new VapiClient({token: VAPI_API_KEY});

/**
 * Schedule a call with Vapi API
 * @param {string} userId - The user ID
 * @param {string} userName - The user's name
 * @param {string} phoneNumber - The phone number to call
 * @param {string} callTime - The time to schedule the call
 * @param {string} callType - Type of call (morning or evening)
 * @return {Promise<any>} The API response data
 */
export async function scheduleVapiCall(
  userId: string,
  userName: string,
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
      name: `${callType.charAt(0).toUpperCase() + callType.slice(1)} Call`,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: phoneNumber,
        name: userName,
      },
      assistantOverrides: {
        backgroundSound: "off"
      },
      schedulePlan: {
        earliestAt: scheduledTime.toISOString(),
        latestAt: new Date(scheduledTime.getTime() + 5 * 60000).toISOString(),
      },
    };

    // Make the API call to Vapi using the SDK
    const response = await vapiClient.calls.create(payload);

    logger.info(
      `Successfully scheduled ${callType} call for user ${userId}`,
      response,
    );
    return response;
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
export function parseTimeString(timeString: string): Date | null {
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

    logger.info(`Scheduled time: ${date.toISOString()}`);
    return date;
  } catch (error) {
    logger.error(`Error parsing time string: ${timeString}`, error);
    return null;
  }
}
