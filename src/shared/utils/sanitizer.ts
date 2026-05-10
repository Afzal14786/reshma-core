/**
 * SECURITY UTILITY: NoSQL Injection Sanitizer
 * * ARCHITECTURE NOTE:
 * Express 5.x defines req.query and req.params as read-only getters.
 * * This utility provides a deep-cleansing mechanism that recursively removes
 * keys starting with '$' or containing '.' to prevent NoSQL Injection attacks.
 * It also neutralizes Prototype Pollution by stripping sensitive JS internals.
 */
export class Sanitizer {
  // Hardened list of prohibited keys to prevent Prototype Pollution
  private static readonly PROHIBITED_KEYS = ["__proto__", "constructor", "prototype"];

  /**
   * Recursively strips MongoDB operator keys ($), dot-notation keys (.), 
   * and sensitive JavaScript internal properties.
   * * @param target - The object or array to sanitize.
   * @returns The sanitized object.
   */
  public static sanitize<T>(target: T): T {
    // 1. Base Case: Return non-objects or null immediately
    if (!target || typeof target !== "object") {
      return target;
    }

    // 2. Handle Arrays
    if (Array.isArray(target)) {
      for (let i = 0; i < target.length; i++) {
        target[i] = this.sanitize(target[i]);
      }
      return target;
    }

    // 3. Handle Objects
    const obj = target as Record<string, unknown>;

    for (const key in obj) {
      // Security Best Practice: Only operate on own properties
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        
        /**
         * SECURITY LAYER 1: Prototype Pollution Defense
         * If the key is a sensitive JS internal, delete it immediately.
         */
        if (this.PROHIBITED_KEYS.includes(key)) {
          delete obj[key];
          continue;
        }

        /**
         * SECURITY LAYER 2: NoSQL Injection Defense
         * Strip MongoDB operators ($) and dot-notation keys (.)
         */
        if (key.startsWith("$") || key.includes(".")) {
          delete obj[key];
        } else {
          // 4. Recursive Step: Deep clean nested values
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
