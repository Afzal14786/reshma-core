// ──────────────────────────────────────────────
// Mock for `file-type` (ESM-only package)
// Returns deterministic results so upload middleware tests are repeatable.
// ──────────────────────────────────────────────

export const fileTypeFromBuffer = jest.fn(async (_buffer: Buffer) => {
  // Default: pretend it's a PNG. Override per-test with .mockResolvedValueOnce(...)
  return { ext: "png", mime: "image/png" };
});

export const fileTypeFromStream = jest.fn(async (_stream: NodeJS.ReadableStream) => {
  return { ext: "png", mime: "image/png" };
});

export const fileTypeFromFile = jest.fn(async (_path: string) => {
  return { ext: "png", mime: "image/png" };
});