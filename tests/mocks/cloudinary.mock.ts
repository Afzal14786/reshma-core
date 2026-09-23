// ──────────────────────────────────────────────
// Cloudinary mock — no real uploads/deletes during tests
// ──────────────────────────────────────────────

let uploadCounter = 0;

export const uploadBufferToCloudinary = jest.fn(
  async (_buffer: Buffer, folderName: string): Promise<string> => {
    uploadCounter += 1;
    return `https://res.cloudinary.com/test-cloud/image/upload/reshma-core/${folderName}/test-${uploadCounter}.webp`;
  },
);

export const deleteFromCloudinary = jest.fn(
  async (_secureUrl: string): Promise<void> => {
    // no-op
  },
);

export const extractPublicId = jest.fn(
  (secureUrl: string): string =>
    `reshma-core/products/${secureUrl.split("/").pop() ?? "unknown"}`,
);

export default {
  config: jest.fn(),
  uploader: {
    upload_stream: jest.fn(),
    destroy: jest.fn(),
  },
};

// Test helper — reset the URL counter between tests
export function __resetCloudinaryMock(): void {
  uploadCounter = 0;
}