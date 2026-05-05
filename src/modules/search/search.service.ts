import { typesenseClient } from "@config/typesense";
import { SearchQueryInput } from "./dtos/search.dto";
import logger from "@config/logger";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import {
  SearchParams,
  SearchResponseHit,
} from "typesense/lib/Typesense/Documents";

/**
 * ARCHITECTURE NOTE:
 * Matches the strict RAM schema defined in TypesenseManager.
 * Prevents generic type confusion in the SDK's internal response handlers.
 */
interface ITypesenseProductDoc {
  id: string;
  itemType: string;
  sku: string;
  name: string;
  description: string;
  mainCategory: string;
  basePrice: number;
  tags?: string[];
  images?: string[];
}

/**
 * Search Service
 * The dedicated domain orchestrator for the Typesense RAM engine.
 * Bypasses MongoDB entirely to deliver sub-50ms typo-tolerant faceted search.
 */
export class SearchService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Prevents CRLF Log Injection attacks by stripping control characters
   * before they interact with the Winston output streams.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method executeSearch
   * @description Pings the Typesense RAM cluster to return typo-tolerant, faceted results.
   * Returns RAW data to be wrapped by the Controller's ApiResponse.
   */
  public static async executeSearch(queryData: SearchQueryInput) {
    const {
      q,
      page,
      limit,
      itemType,
      mainCategory,
      minPrice,
      maxPrice,
      sortBy,
    } = queryData;

    // Build the dynamic Filter String required by Typesense
    const filterConditions: string[] = [];

    if (itemType) filterConditions.push(`itemType:=[${itemType}]`);
    if (mainCategory) filterConditions.push(`mainCategory:=[${mainCategory}]`);
    if (minPrice !== undefined)
      filterConditions.push(`basePrice:>=${minPrice}`);
    if (maxPrice !== undefined)
      filterConditions.push(`basePrice:<=${maxPrice}`);

    const filterBy =
      filterConditions.length > 0 ? filterConditions.join(" && ") : undefined;

    // Construct Search Parameters using strict typing
    const searchParameters: SearchParams<ITypesenseProductDoc> = {
      q,
      query_by: "name,description,tags,sku",
      page,
      per_page: limit,
      num_typos: 2,
      typo_tokens_threshold: 1,
      facet_by: "itemType,mainCategory",
    };

    // Conditional Property Assignment to satisfy 'exactOptionalPropertyTypes'
    if (filterBy) {
      searchParameters.filter_by = filterBy;
    }

    if (sortBy) {
      searchParameters.sort_by = sortBy;
    }

    try {
      // Execute the RAM Query
      const searchResults = await typesenseClient
        .collections<ITypesenseProductDoc>("products")
        .documents()
        .search(searchParameters);

      // Transformation of RAM hits back to clean objects
      const hits =
        (searchResults.hits as SearchResponseHit<ITypesenseProductDoc>[]) || [];
      const products = hits.map((hit) => hit.document);

      // We return the RAW object here. The Controller handles the ApiResponse wrapper.
      return {
        products,
        meta: {
          found: searchResults.found,
          page: searchResults.page,
          outOf: searchResults.out_of,
          searchTimeMs: searchResults.search_time_ms,
        },
        facets: searchResults.facet_counts,
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Search engine timeout";
      logger.error(
        this.safeLog(`[Search API] Typesense execution failed: ${errMsg}`),
      );

      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "The search engine is currently experiencing high latency. Please try again.",
      );
    }
  }
}
