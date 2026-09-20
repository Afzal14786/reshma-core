import { safeCompare, encrypt, decrypt } from "@shared/utils/crypto.utils";

describe("safeCompare", () => {
  it("returns true for identical strings", () => {
    expect(safeCompare("hello", "hello")).toBe(true);
  });

  it("returns true for identical hex strings (Razorpay signature shape)", () => {
    const hex = "a".repeat(64);
    expect(safeCompare(hex, hex)).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(safeCompare("hello", "world")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(safeCompare("short", "longer-string")).toBe(false);
  });

  it("returns false for empty left operand", () => {
    expect(safeCompare("", "hello")).toBe(false);
  });

  it("returns false for empty right operand", () => {
    expect(safeCompare("hello", "")).toBe(false);
  });

  it("returns false for null-ish inputs", () => {
    expect(safeCompare(null as unknown as string, "hello")).toBe(false);
    expect(safeCompare("hello", undefined as unknown as string)).toBe(false);
    expect(safeCompare("", "")).toBe(false);
  });
});

describe("encrypt / decrypt", () => {
  it("round-trips simple ASCII text", () => {
    const plaintext = "Hello, World!";
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(":")).toHaveLength(3);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips unicode text", () => {
    const plaintext = "नमस्ते दुनिया 🔒 ₹500";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("round-trips a long string", () => {
    const plaintext = "x".repeat(10_000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const c1 = encrypt("same-input");
    const c2 = encrypt("same-input");

    expect(c1).not.toBe(c2);
    expect(decrypt(c1)).toBe("same-input");
    expect(decrypt(c2)).toBe("same-input");
  });

  it("throws when the auth tag is tampered", () => {
    const ciphertext = encrypt("secret");
    const [iv, authTag, data] = ciphertext.split(":");
    const tampered = `${iv}:${Buffer.from("x".repeat(16)).toString("base64")}:${data}`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when the ciphertext data is tampered", () => {
    const ciphertext = encrypt("secret");
    const [iv, authTag] = ciphertext.split(":");
    const tampered = `${iv}:${authTag}:AAAAAAAAAAAAAA==`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on malformed input (missing segments)", () => {
    expect(() => decrypt("notvalid")).toThrow("Invalid encrypted data format");
    expect(() => decrypt("only:two")).toThrow("Invalid encrypted data format");
  });
});
