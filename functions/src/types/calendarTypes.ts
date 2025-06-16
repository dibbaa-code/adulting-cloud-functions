/**
 * Shared types for Calendar functionality
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  status: string;
  htmlLink: string;
}

// Get calendar events endpoint arguments
export interface GetCalendarEventsArguments {
  user_id: string;
}

// Function call interfaces for the calendar endpoint
export interface GetCalendarEventsFunctionCall {
  arguments: GetCalendarEventsArguments;
  name: string;
}

// Update the VAPI interfaces to include the new function call type
import { VapiToolCall as BaseVapiToolCall } from './plannerTypes';

export interface CalendarVapiToolCall extends Omit<BaseVapiToolCall, 'function'> {
  function: GetCalendarEventsFunctionCall;
}

// Response interface for calendar events
export interface CalendarEventsResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
}
