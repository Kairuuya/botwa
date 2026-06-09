/**
 * Validates whether the input is a string that represents a valid JSON Object or Array.
 *
 * @param str - The value to be validated.
 * @returns True if the value is a valid JSON string, otherwise false.
 */
export const isJSON = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
};

/**
 * Validates whether the input is a valid URL (HTTP/HTTPS protocols only).
 *
 * @param str - The value to be validated.
 * @returns True if the value is a valid HTTP/HTTPS URL, otherwise false.
 */
export const isURL = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates whether the input is a valid email address.
 *
 * @param str - The value to be validated.
 * @returns True if the value is a valid email address, otherwise false.
 */
export const isEmail = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  // Standard regular expression to mitigate Regular Expression Denial of Service (ReDoS) risks.
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(str);
};

/**
 * Checks if a value is empty (null, undefined, or an empty string, array, buffer, map, set, or object).
 * Fully type-safe implementation without using 'any'.
 *
 * @param value - The value to be checked.
 * @returns True if the value is empty, otherwise false.
 */
export const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (Buffer.isBuffer(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;

  // Safely check plain object keys without prototype pollution risks
  if (typeof value === 'object') {
    // Prevent checking special instances like RegExp or Date as "empty objects"
    if (value instanceof RegExp || value instanceof Date) return false;
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
};

/**
 * Checks if a value is a valid numeric representation (including negative numbers, floats, and shorthand notation like ".5").
 * Matches both number types and numeric strings (e.g., "-123.45", ".5", "-.5").
 *
 * @param value - The value to be checked.
 * @returns True if the value is a valid numeric representation, otherwise false.
 */
export const isNumeric = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return !Number.isNaN(value) && Number.isFinite(value);
  }
  if (typeof value === 'string') {
    // Supports integers, decimals, negative signs, and leading-decimal shorts like ".5"
    return /^-?(?:\d+(\.\d+)?|\.\d+)$/.test(value);
  }
  return false;
};

/**
 * Validates a basic phone number format by stripping common separators and checking digits.
 *
 * @param str - The value to be validated.
 * @returns True if the value is a valid phone number, otherwise false.
 */
export const isPhoneNumber = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  const cleaned = str.replace(/[\s\-()]/g, '');
  return /^\+?\d{10,15}$/.test(cleaned);
};

/**
 * Checks if a string contains only alphanumeric characters.
 *
 * @param str - The value to be checked.
 * @returns True if the string is alphanumeric, otherwise false.
 */
export const isAlphanumeric = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  return /^[a-zA-Z0-9]+$/.test(str);
};

/**
 * Validates that the input is an array where all elements satisfy a specific type guard.
 * Highly useful for validating data fetching payloads and structured collections.
 *
 * @template T - The expected element type.
 * @param value - The value to be checked.
 * @param validator - A type guard function for elements of type T.
 * @returns True if the value is an array of type T, otherwise false.
 */
export const isArrayOf = <T>(
  value: unknown,
  validator: (item: unknown) => item is T,
): value is T[] => {
  return Array.isArray(value) && value.every(validator);
};

/**
 * Checks if a value is a number and falls within the specified range (inclusive).
 *
 * @param value - The value to be checked.
 * @param min - The minimum bound (inclusive).
 * @param max - The maximum bound (inclusive).
 * @returns True if the value is a number within the range, otherwise false.
 */
export const isInRange = (value: unknown, min: number, max: number): value is number => {
  return typeof value === 'number' && value >= min && value <= max;
};
