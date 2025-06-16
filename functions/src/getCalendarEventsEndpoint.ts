/**
 * Get Calendar Events Endpoint
 * This function retrieves events from a user's Google Calendar
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { google } from "googleapis";
import { CalendarEvent } from "./types/calendarTypes";
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

    logger.info("request method verified");

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

    logger.info("API key verified");

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

    logger.info("VAPI request structure verified");

    // Extract data from VAPI request
    const toolCall = vapiRequest.message.toolCallList[0];

    // Use environment variables or hardcoded values for authentication
    const ACCESS_TOKEN =
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || "your-access-token-here";

    logger.info("Access token length:", ACCESS_TOKEN.length);
    logger.info("Access token first 10 chars:", ACCESS_TOKEN.substring(0, 10));

    // Create OAuth2 client with the access token
    const oAuth2Client = new google.auth.OAuth2();
    oAuth2Client.setCredentials({
      access_token: ACCESS_TOKEN,
    });

    logger.info("OAuth2 client created with credentials");

    // Create Calendar API client
    const calendar = google.calendar({
      version: "v3",
      auth: oAuth2Client
    });

    // Set auth for all calendar requests
    const calendarWithAuth = {
      events: {
        list: async (params: any) => {
          return await calendar.events.list({
            ...params,
            auth: oAuth2Client,
          });
        },
      },
    };

    logger.info("Calendar API client created");

    // Use hardcoded values for calendar parameters
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default to 1 day from now
    const maxResults = 50;
    const calendarId = "primary";

    logger.info("Calendar parameters set");

    // Get events from Calendar API
    const response = await calendarWithAuth.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    logger.info("Events retrieved from Calendar API");
    logger.info("Events: " + response.data.items);

    // Process the events
    const events =
      response.data.items?.map((event) => {
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

    logger.info("Events processed");
    logger.info("Events: " + events);

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
