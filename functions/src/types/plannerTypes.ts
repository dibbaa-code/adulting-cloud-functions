/**
 * Shared types for Planner functionality
 */

export interface TaskItem {
  id: string;
  text: string;
  isComplete: boolean;
}

// Flexible input type for API compatibility (accepts both naming conventions)
export interface TaskItemInput {
  id: string;
  text: string;
  isComplete?: boolean;
  is_complete?: boolean; // using both because vapi was sending either of these
}

export interface MealPlan {
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
}

export interface PartialMealPlan {
  breakfast?: string;
  lunch?: string;
  snacks?: string;
  dinner?: string;
}

export interface PlannerDocument {
  tasks: TaskItem[];
  meals: MealPlan;
  createdAt: Date;
  lastModified: Date;
  modifiedBy: string;
}

// Get planner endpoint arguments
export interface GetPlannerArguments {
  user_id: string;
}

// Update tasks endpoint arguments
export interface UpdateTasksArguments {
  user_id: string;
  tasks: TaskItemInput[];
}

// Update task completion status arguments
export interface UpdateTaskCompletionArguments {
  user_id: string;
  task_id: string;
  is_complete: boolean;
}

// Update meals endpoint arguments
export interface UpdateMealsArguments {
  user_id: string;
  meals: PartialMealPlan;
}

// Function call interfaces for each endpoint
export interface GetPlannerFunctionCall {
  arguments: GetPlannerArguments;
  name: string;
}

export interface UpdateTasksFunctionCall {
  arguments: UpdateTasksArguments;
  name: string;
}

export interface UpdateTaskCompletionFunctionCall {
  arguments: UpdateTaskCompletionArguments;
  name: string;
}

export interface UpdateMealsFunctionCall {
  arguments: UpdateMealsArguments;
  name: string;
}

// Base VAPI interfaces
export interface VapiToolCall {
  function:
    | GetPlannerFunctionCall
    | UpdateTasksFunctionCall
    | UpdateTaskCompletionFunctionCall
    | UpdateMealsFunctionCall;
  id: string;
  type: string;
}

export interface VapiMessage {
  toolCallList: VapiToolCall[];
}

export interface VapiRequest {
  message: VapiMessage;
}

// Common response interfaces
export interface OperationResponse {
  success: boolean;
  message: string;
  timestamp: string;
  operation_id?: string;
}

export interface TasksResponse extends OperationResponse {
  tasks: TaskItem[];
  total_tasks: number;
  completed_tasks: number;
}

export interface MealsResponse extends OperationResponse {
  meals: MealPlan;
}
