/**
 * SECURITY UTILITY: NoSQL Injection Sanitizer
 * * ARCHITECTURE NOTE:
 * Express 5.x defines req.query and req.params as read-only getters.
 * Standard middleware like 'express-mongo-sanitize' fails because it attempts
 * to reassign these properties (e.g., req.query = sanitized).
 * * This utility provides a deep-cleansing mechanism that recursively removes
 * keys starting with '$' or containing '.' to prevent NoSQL Injection attacks
 * (CWE-943). It is designed to work on clones of Express objects to bypass
 * the read-only restriction.
 */
export class Sanitizer {
  /**
   * Recursively strips MongoDB operator keys ($) and dot-notation keys (.)
   * from an object.
   * * @param target - The object or array to sanitize.
   * @returns The sanitized object of the same type.
   */
  public static sanitize<T>(target: T): T {
    // If the target is not an object or is null, return as is (base case)
    if (!target || typeof target !== "object") {
      return target;
    }

    // Handle Arrays (recursively sanitize each element)
    if (Array.isArray(target)) {
      for (let i = 0; i < target.length; i++) {
        target[i] = this.sanitize(target[i]);
      }
      return target;
    }

    // Handle Objects
    // We cast to Record<string, unknown> to allow string-based indexing safely
    const obj = target as Record<string, unknown>;

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // NoSQL Injection Detection: Keys starting with $ or containing .
        if (key.startsWith("$") || key.includes(".")) {
          /**
           * SECURITY LOGIC:
           * We delete the key entirely. In the context of MongoDB, keys starting
           * with $ are operators (e.g., $gt, $ne) which attackers use to
           * bypass authentication or extract unauthorized data.
           */
          delete obj[key];
        } else {
          // Recursive call for nested objects
          const value = obj[key];
          if (value && typeof value === "object") {
            obj[key] = this.sanitize(value);
          }
        }
      }
    }

    return target;
  }
}
