import { AppError } from "@shared/utils/app-error";

describe("AppError", () => {
  describe("construction", () => {
    it("sets statusCode and message", () => {
      const err = new AppError(400, "Bad request");
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Bad request");
    });

    it("sets status='fail' for 4xx codes", () => {
      expect(new AppError(400, "x").status).toBe("fail");
      expect(new AppError(401, "x").status).toBe("fail");
      expect(new AppError(404, "x").status).toBe("fail");
      expect(new AppError(409, "x").status).toBe("fail");
      expect(new AppError(429, "x").status).toBe("fail");
    });

    it("sets status='error' for 5xx codes", () => {
      expect(new AppError(500, "x").status).toBe("error");
      expect(new AppError(503, "x").status).toBe("error");
    });

    it("sets isOperational=true", () => {
      expect(new AppError(400, "x").isOperational).toBe(true);
      expect(new AppError(500, "x").isOperational).toBe(true);
    });

    it("is an instanceof Error and AppError", () => {
      const err = new AppError(400, "x");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it("captures a stack trace", () => {
      expect(new AppError(400, "x").stack).toBeDefined();
    });
  });

  describe("throwability", () => {
    it("can be thrown and caught", () => {
      expect(() => {
        throw new AppError(401, "Unauthorized");
      }).toThrow(AppError);
    });

    it("preserves message when caught", () => {
      try {
        throw new AppError(403, "Forbidden");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).message).toBe("Forbidden");
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });
});