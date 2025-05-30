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
  PartialMealPlan,
} from "./types/plannerTypes.js";

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.VAPI_API_KEY || "";

// Constants
const MAX_MEAL_LENGTH = 1000; // Maximum characters per meal description

type MealType = keyof PartialMealPlan;

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
    const { user_id, meals } = args;

    // Validate required fields
    if (!user_id || !meals) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: user_id or meals",
        code: 400,
      });
      return;
    }

    // Validate meals object structure
    const allowedMealTypes: MealType[] = [
      "breakfast",
      "lunch",
      "snacks",
      "dinner",
    ];
    const providedMealTypes = Object.keys(meals) as MealType[];

    // Check if at least one meal type is provided
    if (providedMealTypes.length === 0) {
      res.status(400).json({
        success: false,
        error:
          "At least one meal type must be provided (breakfast, lunch, snacks, dinner)",
        code: 400,
      });
      return;
    }

    // Validate only the provided meal types
    for (const mealType of providedMealTypes) {
      if (!allowedMealTypes.includes(mealType)) {
        res.status(400).json({
          success: false,
          error: `Invalid meal type: ${mealType}. Allowed types: ${allowedMealTypes.join(
            ", "
          )}`,
          code: 400,
        });
        return;
      }

      const mealValue = meals[mealType];
      if (mealValue === undefined || typeof mealValue !== "string") {
        res.status(400).json({
          success: false,
          error: `${mealType} must be a string`,
          code: 400,
        });
        return;
      }

      if (mealValue.length > MAX_MEAL_LENGTH) {
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
      // Create new planner document with default empty meals, then update with provided meals
      const defaultMeals: MealPlan = {
        breakfast: "",
        lunch: "",
        snacks: "",
        dinner: "",
      };

      const newPlanner: PlannerDocument = {
        tasks: [],
        meals: { ...defaultMeals, ...meals },
        createdAt: now,
        lastModified: now,
        modifiedBy: toolCall.id,
      };

      await plannerRef.set(newPlanner);
    } else {
      // Get existing data and merge with new meals
      const existingData = doc.data() as PlannerDocument;
      const updatedMeals = { ...existingData.meals, ...meals };

      // Update existing planner document
      await plannerRef.update({
        meals: updatedMeals,
        lastModified: now,
        modifiedBy: toolCall.id,
      });
    }

    // Get the final meal state for response
    const finalDoc = await plannerRef.get();
    const finalData = finalDoc.data() as PlannerDocument;

    // Prepare response
    const response: MealsResponse = {
      success: true,
      message: "Meals updated successfully",
      timestamp: now.toISOString(),
      operation_id: toolCall.id,
      meals: finalData.meals,
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
