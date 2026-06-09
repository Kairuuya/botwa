/**
 * ══════════════════════════════════════════════════════════════════════
 * Generic AI Chat Types — Type-Safe Base Layer
 * ══════════════════════════════════════════════════════════════════════
 *
 * Every type here is generic and domain-agnostic.
 * Domain-specific types (SuggestionSheet, etc.) extend these via generics.
 *
 * Follows the same pattern as SessionService<T>:
 *   SessionService<AiChatSessionPayload<SuggestionContext>>
 *
 * NO `any` types — everything is constrained and type-safe.
 */

// ─── Message Types (already general, no changes needed) ──────────────

/**
 * Strict role definitions for AI conversational context.
 */
export type AiChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Extended message type that supports tool-calling flow.
 * Compatible with OpenRouter's ChatMessages union.
 */
export interface AiChatMessage {
  role: AiChatRole;
  content: string | null;
  /** Present on assistant messages that request tool calls */
  toolCalls?: AiToolCallInfo[];
  /** Present on tool-result messages */
  toolCallId?: string;
}

/**
 * Lightweight representation of a tool call from the AI.
 */
export interface AiToolCallInfo {
  id: string;
  name: string;
  arguments: string; // Raw JSON string from the model
}

// ─── User Info (generic base) ────────────────────────────────────────

/**
 * Minimal user identity required by the AI system.
 * Extend this interface for domain-specific user fields.
 *
 * @example
 * ```ts
 * // For Suggestion Sheet domain:
 * interface SuggestionUserInfo extends BaseUserInfo {
 *   departemen: string;
 * }
 * ```
 */
export interface BaseUserInfo {
  userId: string;
  displayName: string;
}

// ─── Session Payload (generic with TContext slot) ────────────────────

/**
 * Generic AI chat session payload stored in Redis/DB via SessionService.
 *
 * @template TContext - Domain-specific context data.
 *   Use a concrete interface (e.g. `SuggestionContext`) — NOT `Record<string, any>`.
 *   Defaults to `Record<string, never>` (empty object) for context-free sessions.
 *
 * Composes cleanly with SessionService:
 *   `SessionService<AiChatSessionPayload<SuggestionContext>>`
 */
export interface AiChatSessionPayload<TContext extends object = Record<string, never>> {
  userId: string;
  displayName: string;
  isActive: boolean;
  messages: AiChatMessage[];
  toolCallCount: number;
  /** Domain-specific context data. Empty object `{}` if no context needed. */
  context: TContext;
}

// ─── Response (generic with TResult slot) ────────────────────────────

/**
 * Generic AI service response.
 *
 * @template TResult - The type of domain-specific result data (if any).
 *   For SuggestionSheet domain, TResult = SuggestionSheet.
 *   For a general chatbot, TResult = never (no result expected).
 */
export interface AiResponse<TResult = never> {
  reply: string;
  isFinished: boolean;
  /** Domain-specific result from a tool call (e.g. a saved SuggestionSheet). */
  result?: TResult;
}

// ─── Service Configuration (injectable hooks) ───────────────────────

/**
 * Configuration hooks that inject domain-specific behavior into the generic AiService.
 * This is what makes AiService domain-agnostic — all domain logic lives in the config.
 *
 * @template TContext - Session context type (same as AiChatSessionPayload<TContext>).
 * @template TResult - Result type returned when the session completes.
 * @template TUserInfo - User info type (extends BaseUserInfo).
 */
export interface AiServiceConfig<
  TContext extends object,
  TResult,
  TUserInfo extends BaseUserInfo = BaseUserInfo,
> {
  /**
   * Build the system prompt from the current session payload.
   * Called on every AI request — can inject user context, domain rules, etc.
   */
  buildSystemPrompt(payload: AiChatSessionPayload<TContext>): string;

  /**
   * Create the initial domain-specific context from user info.
   * Called once when a new session is created.
   */
  createInitialContext(userInfo: TUserInfo): TContext;

  /**
   * Called after each tool execution. Return a `TResult` to signal session completion.
   * Return `undefined` to continue the conversation.
   *
   * @param toolName - Name of the tool that was just executed.
   * @param toolResultJson - The raw JSON string returned by the tool.
   * @returns The parsed result if the session should finish, or `undefined` to continue.
   */
  onToolResult?(toolName: string, toolResultJson: string): TResult | undefined;
}
