// ──────────────────────────────────────────────
// Typesense mock — no real search engine calls
// ──────────────────────────────────────────────

const upsertMock = jest.fn(async (_doc: Record<string, unknown>): Promise<unknown> => ({}));

const deleteDocMock = jest.fn(async (): Promise<unknown> => ({}));

const documentsMock = jest.fn((id?: string) => {
  if (id !== undefined) {
    // Specific document — .delete()
    return { delete: deleteDocMock };
  }
  // Collection-level — .upsert()
  return { upsert: upsertMock };
});

const collectionsMock = jest.fn((_name: string) => ({
  documents: documentsMock,
  retrieve: jest.fn().mockResolvedValue({}),
  create: jest.fn().mockResolvedValue({}),
}));

export const typesenseClient = {
  collections: collectionsMock,
};

export const typesenseManager = {
  initializeSchema: jest.fn().mockResolvedValue(undefined),
};

export const __typesenseMock = {
  upsert: upsertMock,
  deleteDoc: deleteDocMock,
  documents: documentsMock,
  collections: collectionsMock,
};