import { z } from "zod";

/**
 * ZOD FIREWALL: Dashboard Date Range
 *
 * SECURITY:
 * Coercing the input to native Date objects completely neutralizes NoSQL
 * injection attacks (e.g., passing { "$gte": "" } in the query string).
 */
export const DateRangeQuerySchema = z.object({
  query: z
    .object({
      // z.coerce.date() safely attempts to parse ISO-8601 strings into Date objects.
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .strict()
    .refine(
      (data) => {
        // Temporal Firewall: If both dates are provided, startDate MUST be before endDate.
        if (data.startDate && data.endDate) {
          return data.startDate <= data.endDate;
        }
        return true;
      },
      {
        message:
          "Logical Error: startDate must occur before or at the exact same time as endDate.",
        path: ["startDate"],
      },
    ),
});

export type DateRangeQueryInput = z.infer<typeof DateRangeQuerySchema>["query"];
