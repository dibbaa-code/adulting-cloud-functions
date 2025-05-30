/**
 * Get Today's Planner Endpoint
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import {
  PlannerDocument,
  VapiRequest,
  GetPlannerFunctionCall,
} from "./types/plannerTypes.js";

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.JOURNAL_API_KEY || "";

/**
 * HTTP-triggered function that retrieves today's planner for a user
 */
export const getTodaysPlanner = onRequest(async (req, res) => {
  try {
    // Enhanced logging
    logger.info("Full request object", {
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
    const { arguments: args } = toolCall.function as GetPlannerFunctionCall;
    const { user_id } = args;

    // Validate user_id
    if (!user_id) {
      res.status(400).json({
        success: false,
        error: "Missing user_id in request",
        code: 400,
      });
      return;
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Reference to today's planner document
    const plannerRef = db
      .collection("users")
      .doc(user_id)
      .collection("planner")
      .doc(today);

    // Get the document
    const doc = await plannerRef.get();

    if (!doc.exists) {
      logger.info("No planner exists for today", { today });
      // Return empty planner if no document exists for today
      res.status(200).json({
        results: [
          {
            toolCallId: toolCall.id,
            result: {
              message: "No planner found for today",
              date: today,
              tasks: [],
              meals: {
                breakfast: "",
                lunch: "",
                snacks: "",
                dinner: "",
              },
              total_tasks: 0,
              completed_tasks: 0,
            },
          },
        ],
      });
      return;
    }

    const data = doc.data() as PlannerDocument;

    // Calculate task statistics
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter((task) => task.isComplete).length;

    // Return success response with planner data and statistics in VAPI format
    res.status(200).json({
      results: [
        {
          toolCallId: toolCall.id,
          result: {
            message: "Planner retrieved successfully",
            date: today,
            tasks: data.tasks,
            meals: data.meals,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
          },
        },
      ],
    });
  } catch (error) {
    logger.error("Error in getTodaysPlanner", {
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
