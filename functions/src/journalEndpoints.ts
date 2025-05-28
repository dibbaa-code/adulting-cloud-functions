/**
 * Create To-Do List Endpoint
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.JOURNAL_API_KEY || "";

// VAPI request type definitions
interface ToDoItem {
  text: string;
  isComplete: boolean;
}

interface VapiToolArguments {
  to_do_list: string[]; // Input to do list items
  user_id: string;
}

interface VapiFunctionCall {
  arguments: VapiToolArguments;
  name: string;
}

interface VapiToolCall {
  function: VapiFunctionCall;
  id: string;
  type: string;
}

interface VapiMessage {
  toolCallList: VapiToolCall[];
}

interface VapiRequest {
  message: VapiMessage;
}

/**
 * HTTP-triggered function that creates a to-do list entry for a user
 * This can be called from external services via HTTPS
 */
export const createToDoList = onRequest(async (req, res) => {
  try {
    // Enhanced logging
    logger.info("Full request object", {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });

    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).json({
        success: false,
        error: "Method not allowed. Please use POST.",
        code: 405,
      });
      return;
    }

    // Validate if request body exists
    if (!req.body) {
      logger.error("Request body is missing");
      res.status(400).json({
        success: false,
        error: "Request body is required",
        code: 400,
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
    const { to_do_list } = toolCall.function.arguments;
    let { user_id } = toolCall.function.arguments;

    // Validate to_do_list
    if (!Array.isArray(to_do_list) || to_do_list.length === 0) {
      logger.warn("Invalid to_do_list", { to_do_list });
      res.status(400).json({
        success: false,
        error: "Invalid or empty to_do_list",
        code: 400,
      });
      return;
    }

    // Use default user ID if not provided
    if (!user_id) {
      logger.warn(
        "No user_id found in VAPI request. Using default user id: default_user"
      );
      user_id = "default_user";
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Reference to the customer's to_do_list subcollection
    const todoListRef = db
      .collection("users")
      .doc(user_id)
      .collection("to_do_list")
      .doc(today);

    // Convert new items to ToDoItem objects with isComplete status
    const newTodoItems: ToDoItem[] = to_do_list.map((item) => ({
      text: item,
      isComplete: false, // Default to not completed
    }));

    // Check if document already exists for today
    const existingDoc = await todoListRef.get();

    if (existingDoc.exists) {
      // If document exists, merge new items with existing ones
      const existingData = existingDoc.data();
      const existingItems = existingData?.items || [];

      // Combine existing and new items
      const combinedItems = [...existingItems, ...newTodoItems];

      // Update the document
      await todoListRef.update({
        items: combinedItems,
        updated_at: new Date(),
        vapi_tool_call_id: toolCall.id,
      });

      // Return success response with combined items
      res.status(200).json({
        success: true,
        message: "To-do list updated successfully",
        timestamp: new Date().toISOString(),
        date: today,
        tool_call_id: toolCall.id,
        items: combinedItems,
        itemsAdded: newTodoItems.length,
      });
    } else {
      // If no document exists, create new one
      await todoListRef.set({
        items: newTodoItems,
        created_at: new Date(),
        updated_at: new Date(),
        vapi_tool_call_id: toolCall.id,
      });

      // Return success response
      res.status(200).json({
        success: true,
        message: "To-do list created successfully",
        timestamp: new Date().toISOString(),
        date: today,
        tool_call_id: toolCall.id,
        items: newTodoItems,
        itemsAdded: newTodoItems.length,
      });
    }
  } catch (error) {
    // Enhanced error logging
    logger.error("Error in createToDoList", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : error,
      requestBody: req.body,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});
