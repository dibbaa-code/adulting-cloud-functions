/**
 * Update To-Do Items Endpoint
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import {
  ToDoItem,
  VapiRequest,
  UpdateToDoFunctionCall,
} from "./types/todoTypes.js";

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.JOURNAL_API_KEY || "";

/**
 * HTTP-triggered function that updates the completion status of to-do items
 */
export const updateToDoItems = onRequest(async (req, res) => {
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
    const { arguments: args } = toolCall.function as UpdateToDoFunctionCall;
    const { user_id, items } = args;

    // Validate request data
    if (!user_id || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: "Invalid request. Must provide user_id and items array.",
        code: 400,
      });
      return;
    }

    // Map incoming items to handle both isComplete and is_complete formats
    const mappedItems = items.map((item) => ({
      id: item.id,
      isComplete: "isComplete" in item ? item.isComplete : item.is_complete,
    }));

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Reference to today's to-do list document
    const todoListRef = db
      .collection("users")
      .doc(user_id)
      .collection("to_do_list")
      .doc(today);

    // Get the current document
    const doc = await todoListRef.get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "No to-do list found for today",
        code: 404,
      });
      return;
    }

    const currentData = doc.data();
    const currentItems = currentData?.items || [];

    // Update the status of matching items
    const updatedItems = currentItems.map((item: ToDoItem) => {
      const updateItem = mappedItems.find((update) => update.id === item.id);
      if (updateItem) {
        return {
          ...item,
          isComplete: updateItem.isComplete,
        };
      }
      return item;
    });

    // Update the document
    await todoListRef.update({
      items: updatedItems,
      updated_at: new Date(),
      vapi_tool_call_id: toolCall.id,
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: "To-do items updated successfully",
      timestamp: new Date().toISOString(),
      date: today,
      tool_call_id: toolCall.id,
      updatedItems: items.length,
      items: updatedItems,
    });
  } catch (error) {
    logger.error("Error in updateToDoItems", {
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
