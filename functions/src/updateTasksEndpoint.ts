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
const API_KEY = process.env.JOURNAL_API_KEY || "";

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
    const { user_id, tasks, tool_id } = args;

    // Validate required fields
    if (!user_id || !tasks || !tool_id) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: user_id, tasks, or tool_id",
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

    // Validate each task
    for (const task of tasks) {
      if (!task.id || !task.text || typeof task.isComplete !== "boolean") {
        res.status(400).json({
          success: false,
          error: "Each task must have id, text, and isComplete fields",
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
        tasks,
        meals: {
          breakfast: "",
          lunch: "",
          snacks: "",
          dinner: "",
        },
        createdAt: now,
        lastModified: now,
        modifiedBy: tool_id,
      };

      await plannerRef.set(newPlanner);
    } else {
      // Update existing planner document
      await plannerRef.update({
        tasks,
        lastModified: now,
        modifiedBy: tool_id,
      });
    }

    // Calculate task statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.isComplete).length;

    // Prepare response
    const response: TasksResponse = {
      success: true,
      message: "Tasks updated successfully",
      timestamp: now.toISOString(),
      operation_id: toolCall.id,
      tasks,
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
