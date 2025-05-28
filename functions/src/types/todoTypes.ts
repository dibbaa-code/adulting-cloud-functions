/**
 * Shared types for To-Do List functionality
 */

export interface ToDoItem {
  id: string;
  text: string;
  isComplete: boolean;
  createdAt: Date;
}

// Create endpoint arguments
export interface CreateToDoArguments {
  to_do_list: string[];
  user_id: string;
}

// Update endpoint arguments
export interface UpdateToDoArguments {
  user_id: string;
  items: {
    id: string;
    isComplete?: boolean;
    is_complete?: boolean; // using both because vapi was sending either of these
  }[];
}

// Get endpoint arguments
export interface GetToDoArguments {
  user_id: string;
}

// Function call interfaces for each endpoint
export interface CreateToDoFunctionCall {
  arguments: CreateToDoArguments;
  name: string;
}

export interface UpdateToDoFunctionCall {
  arguments: UpdateToDoArguments;
  name: string;
}

export interface GetToDoFunctionCall {
  arguments: GetToDoArguments;
  name: string;
}

// Base VAPI interfaces
export interface VapiToolCall {
  function:
    | CreateToDoFunctionCall
    | UpdateToDoFunctionCall
    | GetToDoFunctionCall;
  id: string;
  type: string;
}

export interface VapiMessage {
  toolCallList: VapiToolCall[];
}

export interface VapiRequest {
  message: VapiMessage;
}
