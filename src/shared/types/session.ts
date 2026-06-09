/**
 * Standardized generic session metadata structure.
 * @template T - The custom payload structure for the session.
 */
export interface SessionData<T> {
  id: string;
  data: T;
  createdAt: number;
  updatedAt: number;
}
