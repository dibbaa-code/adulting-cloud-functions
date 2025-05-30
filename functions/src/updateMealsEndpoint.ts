/**
 * Update Meals Endpoint
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import {
  PlannerDocument,
  VapiRequest,
  UpdateMealsFunctionCall,
  MealsResponse,
  MealPlan,
} from "./types/plannerTypes.js";

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.JOURNAL_API_KEY || "";

// Constants
const MAX_MEAL_LENGTH = 1000; // Maximum characters per meal description

type MealType = keyof MealPlan;

/**
 * HTTP-triggered function that updates meals in today's planner
 */
export const updateMeals = onRequest(async (req, res) => {
  try {
    // Enhanced logging
    logger.info("Update meals request", {
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
    const { arguments: args } = toolCall.function as UpdateMealsFunctionCall;
    const { user_id, meals, tool_id } = args;

    // Validate required fields
    if (!user_id || !meals || !tool_id) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: user_id, meals, or tool_id",
        code: 400,
      });
      return;
    }

    // Validate meals object structure
    const requiredMealTypes: MealType[] = [
      "breakfast",
      "lunch",
      "snacks",
      "dinner",
    ];
    for (const mealType of requiredMealTypes) {
      if (typeof meals[mealType] !== "string") {
        res.status(400).json({
          success: false,
          error: `Invalid or missing ${mealType} in meals object`,
          code: 400,
        });
        return;
      }

      if (meals[mealType].length > MAX_MEAL_LENGTH) {
        res.status(400).json({
          success: false,
          error: `${mealType} description too long. Maximum length: ${MAX_MEAL_LENGTH} characters`,
          code: 400,
        });
        return;
      }
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Reference to today's planner document
    const plannerRef = db
      .collection("users")
      .doc(user_id)
      .collection("planner")
      .doc(today);

    // Get the current document or create new if doesn't exist
    const doc = await plannerRef.get();
    const now = new Date();

    if (!doc.exists) {
      // Create new planner document
      const newPlanner: PlannerDocument = {
        tasks: [],
        meals,
        createdAt: now,
        lastModified: now,
        modifiedBy: tool_id,
      };

      await plannerRef.set(newPlanner);
    } else {
      // Update existing planner document
      await plannerRef.update({
        meals,
        lastModified: now,
        modifiedBy: tool_id,
      });
    }

    // Prepare response
    const response: MealsResponse = {
      success: true,
      message: "Meals updated successfully",
      timestamp: now.toISOString(),
      operation_id: toolCall.id,
      meals,
    };

    // Return success response
    res.status(200).json({
      results: [
        {
          toolCallId: toolCall.id,
          result: response,
        },
      ],
    });
  } catch (error) {
    logger.error("Error in updateMeals", {
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
