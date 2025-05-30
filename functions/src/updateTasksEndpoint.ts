/**
 * Update Tasks Endpoint
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import {
  PlannerDocument,
  VapiRequest,
  UpdateTasksFunctionCall,
  TasksResponse,
} from "./types/plannerTypes.js";

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.VAPI_API_KEY || "";

// Constants
const MAX_TASKS = 50; // Maximum number of tasks allowed
const MAX_TASK_LENGTH = 500; // Maximum characters per task

/**
 * HTTP-triggered function that updates tasks in today's planner
 */
export const updateTasks = onRequest(async (req, res) => {
  try {
    // Enhanced logging
    logger.info("Update tasks request", {
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
    const { arguments: args } = toolCall.function as UpdateTasksFunctionCall;
    const { user_id, tasks } = args;

    // Validate required fields
    if (!user_id || !tasks) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: user_id or tasks",
        code: 400,
      });
      return;
    }

    // Validate tasks array
    if (!Array.isArray(tasks)) {
      res.status(400).json({
        success: false,
        error: "Tasks must be an array",
        code: 400,
      });
      return;
    }

    // Validate task limits
    if (tasks.length > MAX_TASKS) {
      res.status(400).json({
        success: false,
        error: `Too many tasks. Maximum allowed: ${MAX_TASKS}`,
        code: 400,
      });
      return;
    }

    // Validate and normalize each task
    const normalizedTasks = [];
    for (const task of tasks) {
      if (!task.id || !task.text) {
        res.status(400).json({
          success: false,
          error: "Each task must have id and text fields",
          code: 400,
        });
        return;
      }

      // Handle both isComplete and is_complete for compatibility
      let isComplete: boolean;
      if (typeof task.isComplete === "boolean") {
        isComplete = task.isComplete;
      } else if (typeof task.is_complete === "boolean") {
        isComplete = task.is_complete;
      } else {
        res.status(400).json({
          success: false,
          error:
            "Each task must have isComplete or is_complete field as boolean",
          code: 400,
        });
        return;
      }

      if (task.text.length > MAX_TASK_LENGTH) {
        res.status(400).json({
          success: false,
          error: `Task text too long. Maximum length: ${MAX_TASK_LENGTH} characters`,
          code: 400,
        });
        return;
      }

      // Normalize to our expected format
      normalizedTasks.push({
        id: task.id,
        text: task.text,
        isComplete,
      });
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
        tasks: normalizedTasks,
        meals: {
          breakfast: "",
          lunch: "",
          snacks: "",
          dinner: "",
        },
        createdAt: now,
        lastModified: now,
        modifiedBy: toolCall.id,
      };

      await plannerRef.set(newPlanner);
    } else {
      // Update existing planner document
      await plannerRef.update({
        tasks: normalizedTasks,
        lastModified: now,
        modifiedBy: toolCall.id,
      });
    }

    // Calculate task statistics
    const totalTasks = normalizedTasks.length;
    const completedTasks = normalizedTasks.filter(
      (task) => task.isComplete
    ).length;

    // Prepare response
    const response: TasksResponse = {
      success: true,
      message: "Tasks updated successfully",
      timestamp: now.toISOString(),
      operation_id: toolCall.id,
      tasks: normalizedTasks,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
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
    logger.error("Error in updateTasks", {
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
