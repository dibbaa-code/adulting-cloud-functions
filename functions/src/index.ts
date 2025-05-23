/**
 * Firebase Cloud Functions with Firestore document triggers
 * See full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Import the necessary trigger types from Firebase Functions v2
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

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
  (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    logger.info(
      `User ${userId} updated`,
      {before: beforeData, after: afterData}
    );
    return null;
  }
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
  }
);


