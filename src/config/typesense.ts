import { Client } from "typesense";
import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import env from "./env";
import logger from "./logger";

/**
 * Strict typing for Typesense API errors to avoid 'unknown' cast violations
 * and satisfy strict TypeScript/CodeQL requirements.
 */
interface ITypesenseError extends Error {
  httpStatus?: number;
  message: string;
}

/**
 * TYPESENSE INFRASTRUCTURE & SEARCH MANAGER
 *
 * ARCHITECTURE NOTE:
 * This acts as the singleton bridge to the Typesense RAM cluster.
 * Unlike MongoDB's flexible BSON, Typesense requires an explicitly defined,
 * mathematically flat schema for memory allocation.
 * We intentionally omit heavy, non-searchable data (like deeply nested variant objects)
 * and set `index: false` on images to preserve RAM and maximize query speed.
 */
class TypesenseManager {
  public readonly client: Client;

  constructor() {
    this.client = new Client({
      nodes: [
        {
          host: env.TYPESENSE_HOST,
          port: env.TYPESENSE_PORT,
          protocol: env.TYPESENSE_PROTOCOL,
        },
      ],
      apiKey: env.TYPESENSE_API_KEY,
      connectionTimeoutSeconds: 5,
      // Production Resilience: Automatically retry on temporary network packet loss
      retryIntervalSeconds: 2,
      numRetries: 3,
    });
  }

  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Prevents CRLF Log Injection attacks by stripping control characters
   * before they interact with the Winston output streams.
   */
  private safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method initializeSchema
   * @description Idempotent boot sequence. Validates the existence of the 'products'
   * collection in the Typesense cluster. If absent, it constructs the strict memory schema.
   * @throws Will throw a fatal error if the Typesense cluster is unreachable or auth fails,
   * triggering the Fail-Fast shutdown in server.ts.
   */
  public async initializeSchema(): Promise<void> {
    const schema: CollectionCreateSchema = {
      name: "products",
      fields: [
        // Typesense strictly requires the primary key to be a string named 'id'
        { name: "id", type: "string" },
        { name: "itemType", type: "string", facet: true },
        { name: "sku", type: "string" },
        { name: "name", type: "string" },
        { name: "description", type: "string" },
        { name: "mainCategory", type: "string", facet: true },
        { name: "basePrice", type: "float", facet: true },
        { name: "tags", type: "string[]", optional: true },
        // index: false prevents Typesense from wasting CPU cycles running text-search on a URL.
        { name: "images", type: "string[]", index: false, optional: true },
      ],
    };

    try {
      // Verification: Check if the schema is already built in memory
      await this.client.collections("products").retrieve();
      logger.info(
        this.safeLog(
          "[Typesense] 'products' search index verified and actively loaded in RAM.",
        ),
      );
    } catch (error: unknown) {
      // Strict Error Handling: Type guard to safely check the HTTP status
      const tsError = error as ITypesenseError;

      // Schema Construction: 404 means the cluster is up, but the collection is missing. Build it.
      if (tsError.httpStatus === 404) {
        logger.info(
          this.safeLog(
            "[Typesense] Search index missing. Building strict RAM schema...",
          ),
        );

        try {
          await this.client.collections().create(schema);
          logger.info(
            this.safeLog(
              "[Typesense] Schema successfully built. Ready for data synchronization.",
            ),
          );
        } catch (creationError: unknown) {
          const createErrMsg =
            creationError instanceof Error
              ? creationError.message
              : "Unknown creation error";
          logger.error(
            this.safeLog(
              `[Typesense] Critical Failure during schema creation: ${createErrMsg}`,
            ),
          );
          throw creationError;
        }
      } else {
        // Network/Auth Failure: If it's a 401 (Auth) or 503 (Down), crash the server (Fail-Fast).
        logger.error(
          this.safeLog(
            `[Typesense] Critical Cluster Connection Failure: ${tsError.message || "Unknown Error"}`,
          ),
        );
        throw error;
      }
    }
  }
}

// Export as a Singleton to ensure connection pooling and cache logic is shared globally
export const typesenseManager = new TypesenseManager();
export const typesenseClient = typesenseManager.client;
