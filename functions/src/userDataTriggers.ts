/**
 * User data related Firestore trigger functions
 */
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { scheduleVapiCall } from "./services/vapi";

/**
 * Firestore onCreate trigger - runs when a document is created
 * This example triggers when a new user document is created in the 'users'
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
 * Firestore onUpdate trigger - runs when a user document is updated
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

    const phoneNumber = afterData?.phoneNumber;
    const userName = afterData?.name;
    if (!phoneNumber || !userName) {
      logger.warn(
        `Cannot schedule calls for user ${userId}: ` +
        "No phone number or name found",
      );
      return null;
    }

    try {
      // Schedule morning call if morningCallTime was updated
      if (morningCallTimeChanged) {
        await scheduleVapiCall(
          userId,
          userName,
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
          userName,
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
 * Firestore onDelete trigger - runs when a user document is deleted
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
