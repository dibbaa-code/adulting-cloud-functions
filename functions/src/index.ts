/**
 * Firebase Cloud Functions - Main Entry Point
 * This file imports and re-exports all functions from their respective modules
 */

// Load environment variables from .env file during development
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
}

// Import and re-export User Data trigger functions
import * as userDataTriggers from "./userDataTriggers";
export const onNewUser = userDataTriggers.onNewUser;
export const onUserUpdated = userDataTriggers.onUserUpdated;
export const onUserDeleted = userDataTriggers.onUserDeleted;

// Import and re-export Journal functions
import * as journalFunctions from "./journalEndpoints";
export const createToDoList = journalFunctions.createToDoList;

import * as updateToDoEndpoint from "./updateToDoEndpoint";
export const updateToDoItems = updateToDoEndpoint.updateToDoItems;

import * as getToDoEndpoint from "./getToDoEndpoint";
export const getTodayToDoList = getToDoEndpoint.getTodayToDoList;

// Import and re-export service integrations
// These are not directly exposed as Cloud Functions but can be used by other functions
export { scheduleVapiCall, parseTimeString } from "./services/vapi";
