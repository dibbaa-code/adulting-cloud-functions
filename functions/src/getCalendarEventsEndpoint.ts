/**
 * Get Calendar Events Endpoint
 * This function retrieves events from a user's Google Calendar
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import {
  CalendarEvent,
  GetCalendarEventsFunctionCall
} from "./types/calendarTypes";
import { VapiRequest } from "./types/plannerTypes";

// Initialize services
const API_KEY = process.env.VAPI_API_KEY || "";

/**
 * HTTP-triggered function that lists calendar events
 * Requires a valid Google OAuth access token with Calendar API scope
 */
export const getCalendarEvents = onRequest(async (req, res) => {
  try {
    // Enhanced logging
    logger.info("Calendar events request", {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });

    // Only allow POST requests (since VAPI sends data via POST)
    if (req.method !== "POST") {
      res.status(405).json({
        success: false,
        error: "Method not allowed. Please use POST.",
        code: 405,
      });
      return;
    }

    // Validate API key from headers
    const providedApiKey = req.headers.apikey;
    if (!providedApiKey || providedApiKey !== API_KEY) {
      logger.warn("Unauthorized access attempt", {
        ip: req.ip,
        headers: req.headers,
      });
      res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing API key",
        code: 401,
      });
      return;
    }

    // Extract and validate VAPI request structure
    const vapiRequest = req.body as VapiRequest;
    if (!vapiRequest?.message?.toolCallList?.[0]?.function?.arguments) {
      logger.warn("Invalid VAPI request structure", { body: req.body });
      res.status(400).json({
        success: false,
        error: "Invalid request structure. Expected VAPI tool call format.",
        code: 400,
      });
      return;
    }

    // Extract data from VAPI request
    const toolCall = vapiRequest.message.toolCallList[0];
    const { arguments: args } = toolCall.function as GetCalendarEventsFunctionCall;

    // Validate only the user_id parameter
    if (!args.user_id) {
      res.status(400).json({
        success: false,
        error: "Missing user_id in request",
        code: 400,
      });
      return;
    }

    // Use environment variables or hardcoded values for authentication
    const ACCESS_TOKEN = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || "your-access-token-here";
    
    // Create OAuth2 client with the hardcoded access token
    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: ACCESS_TOKEN });

    // Create Calendar API client
    const calendar = google.calendar({ version: "v3" });
    
    // Set auth for all calendar requests
    const calendarWithAuth = { 
      events: {
        list: async (params: any) => {
          return await calendar.events.list({
            ...params,
            auth: oAuth2Client
          });
        }
      }
    };

    // Use hardcoded values for calendar parameters
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default to 1 day from now
    const maxResults = 50;
    const calendarId = "primary";

    // Get events from Calendar API
    const response = await calendarWithAuth.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    // Process the events
    const events = response.data.items?.map((event) => {
      return {
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        organizer: event.organizer,
        status: event.status,
        htmlLink: event.htmlLink,
      } as CalendarEvent;
    }) || [];

    // Return success response in VAPI format
    res.status(200).json({
      results: [
        {
          toolCallId: toolCall.id,
          result: {
            message: "Calendar events retrieved successfully",
            events: events,
            total_events: events.length,
            nextPageToken: response.data.nextPageToken,
          },
        },
      ],
    });
  } catch (error) {
    logger.error("Error in getCalendarEvents", {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
      requestBody: req.body,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});
