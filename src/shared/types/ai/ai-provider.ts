/**
 * Strict role definitions for conversational AI context.
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Standardized chat message payload.
 */
export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  /** Tool calls requested by the assistant */
  toolCalls?: ToolCallResult[];
  /** ID of the tool call this message responds to (role: 'tool') */
  toolCallId?: string;
}

/**
 * Definition of a tool that the AI can invoke.
 * `parameters` is a JSON Schema object (derived from Zod at runtime).
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * A single tool call parsed from the AI response.
 */
export interface ToolCallResult {
  id: string;
  name: string;
  arguments: string; // Raw JSON string
}

/**
 * Response from chatWithTools — contains text, tool calls, and finish reason.
 */
export interface ChatWithToolsResponse {
  content: string | null;
  toolCalls: ToolCallResult[];
  finishReason: string;
}

/**
 * Interface representing a standard AI text generation provider.
 * This contract ensures all integrated AI models can be swapped
 * seamlessly and handled identically by the fallback runner.
 */
export interface IAiProvider {
  /**
   * The specific AI model identifier currently in use by this provider.
   */
  readonly modelName: string;
  /**
   * Handles conversational turns with the user to gather context organically.
   * @param messages - The sliding window of conversation history.
   * @returns A promise resolving to the AI's response text.
   */
  chat(messages: ChatMessage[]): Promise<string>;

  /**
   * Hidden background method to extract the conversation history into a structured JSON string.
   * @param messages - The full conversation history containing the gathered facts.
   * @returns A promise resolving to a raw JSON string matching the SQCDPME schema.
   */
  extractToJSON(messages: ChatMessage[]): Promise<string>;

  /**
   * Chat with tool-calling support.
   * Sends tool definitions alongside messages and returns tool call requests from the AI.
   *
   * @param messages - Conversation history including tool results.
   * @param tools - Available tool definitions the AI can invoke.
   * @returns Response with optional text content and/or tool calls.
   */
  chatWithTools(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatWithToolsResponse>;

  /**
   * Verifies if this provider has all the necessary configurations (like API keys) to run.
   *
   * @returns True if configured and ready to be used, false otherwise.
   */
  isConfigured(): boolean;
}
