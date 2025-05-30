/**
 * Update Task Completion Status Endpoint
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import {
  PlannerDocument,
  VapiRequest,
  UpdateTaskCompletionFunctionCall,
  TasksResponse,
} from "./types/plannerTypes.js";

// Initialize Firestore
const db = getFirestore();

// API key for authentication
const API_KEY = process.env.JOURNAL_API_KEY || "";

/**
 * HTTP-triggered function that updates a task's completion status in today's planner
 */
export const updateTaskCompletion = onRequest(async (req, res) => {
  try {
    // Enhanced logging
    logger.info("Update task completion request", {
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
    const { arguments: args } =
      toolCall.function as UpdateTaskCompletionFunctionCall;
    const { user_id, task_id, is_complete, tool_id } = args;

    // Validate required fields
    if (!user_id || !task_id || typeof is_complete !== "boolean" || !tool_id) {
      res.status(400).json({
        success: false,
        error:
          "Missing or invalid required fields: user_id, task_id, is_complete, or tool_id",
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

    // Get the current document
    const doc = await plannerRef.get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "No planner found for today",
        code: 404,
      });
      return;
    }

    const data = doc.data() as PlannerDocument;
    const now = new Date();

    // Find and update the task
    const taskIndex = data.tasks.findIndex((task) => task.id === task_id);
    if (taskIndex === -1) {
      res.status(404).json({
        success: false,
        error: "Task not found",
        code: 404,
      });
      return;
    }

    // Update the task's completion status
    data.tasks[taskIndex].isComplete = is_complete;

    // Update the document
    await plannerRef.update({
      tasks: data.tasks,
      lastModified: now,
      modifiedBy: tool_id,
    });

    // Calculate task statistics
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter((task) => task.isComplete).length;

    // Prepare response
    const response: TasksResponse = {
      success: true,
      message: `Task ${
        is_complete ? "marked as complete" : "marked as incomplete"
      }`,
      timestamp: now.toISOString(),
      operation_id: toolCall.id,
      tasks: data.tasks,
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
    logger.error("Error in updateTaskCompletion", {
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
