import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { User } from "@modules/users/user.model";

const API = "/api/v1/users/profile";

describe("User Profile API — /api/v1/users/profile", () => {
  describe("GET /profile", () => {
    it("returns the authenticated user's profile without the password field", async () => {
      const { user, accessToken } = await createUserWithToken();

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.email).toBe(user.email);
      expect(res.body.data).not.toHaveProperty("password");
    });

    it("returns 401 without auth", async () => {
      const res = await request.get(API);
      expectError(res, 401);
    });
  });

  describe("PATCH /profile", () => {
    it("updates firstname, lastname, phone, gender, and dob", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          firstname: "Updated",
          lastname: "Name",
          phone: "9876543210",
          gender: "MALE",
          dob: "1995-06-15T00:00:00.000Z",
        });

      expectSuccess(res, 200);
      expect(res.body.data.firstname).toBe("Updated");
      expect(res.body.data.lastname).toBe("Name");
      expect(res.body.data.phone).toBe("9876543210");
      expect(res.body.data.gender).toBe("MALE");
    });

    it("rejects mass assignment attempts (role, isEmailVerified)", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          firstname: "OK",
          role: "ADMIN",
          isEmailVerified: true,
          loyaltyPoints: 999999,
        });

      expectError(res, 400);
    });

    it("rejects invalid phone format", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ phone: "123" });

      expectError(res, 400);
    });

    it("rejects invalid gender value", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ gender: "NONBINARY" });

      expectError(res, 400);
    });

    it("returns 401 without auth", async () => {
      const res = await request.patch(API).send({ firstname: "x" });
      expectError(res, 401);
    });
  });

  describe("Address Book", () => {
    it("POST /addresses adds a new address", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "123 Test Street",
          city: "Kolkata",
          state: "WB",
          pincode: "700001",
          label: "HOME",
        });

      expectSuccess(res, 201);
      expect(res.body.data).toHaveLength(1);
    });

    it("first address becomes default automatically", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "123 Test Street",
          city: "Kolkata",
          state: "WB",
          pincode: "700001",
          label: "HOME",
        });

      expectSuccess(res, 201);
      expect(res.body.data[0].isDefault).toBe(true);
    });

    it("PATCH /addresses/:id demotes previous default when setting a new one", async () => {
      const { accessToken } = await createUserWithToken();

      // First address (auto-default)
      await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "123 Home Street",
          city: "Kolkata",
          state: "WB",
          pincode: "700001",
          label: "HOME",
        });

      // Second address (make default)
      const second = await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "456 Work Avenue",
          city: "Kolkata",
          state: "WB",
          pincode: "700002",
          label: "WORK",
        });

      const secondId = second.body.data[1]._id;

      const res = await request
        .patch(`${API}/addresses/${secondId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ isDefault: true });

      expectSuccess(res, 200);
      const addresses = res.body.data;
      const defaults = addresses.filter((a: { isDefault: boolean }) => a.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]._id).toBe(secondId);
    });

    it("DELETE /addresses/:id removes the address", async () => {
      const { accessToken } = await createUserWithToken();

      const create = await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "123 Test Street",
          city: "Kolkata",
          state: "WB",
          pincode: "700001",
          label: "HOME",
        });

      const addressId = create.body.data[0]._id;

      const res = await request
        .delete(`${API}/addresses/${addressId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data).toHaveLength(0);
    });

    it("deleting the default promotes the next address", async () => {
      const { accessToken } = await createUserWithToken();

      const first = await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "123 Home Street",
          city: "Kolkata",
          state: "WB",
          pincode: "700001",
          label: "HOME",
        });

      await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "456 Work Avenue",
          city: "Kolkata",
          state: "WB",
          pincode: "700002",
          label: "WORK",
        });

      const defaultAddressId = first.body.data[0]._id;

      const res = await request
        .delete(`${API}/addresses/${defaultAddressId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].isDefault).toBe(true);
    });

    it("rejects the 11th address (limit 10)", async () => {
      const { user, accessToken } = await createUserWithToken();

      // Seed 10 addresses directly in the DB
      const addresses = Array.from({ length: 10 }, (_, i) => ({
        _id: new (require("mongoose").Types.ObjectId)(),
        street: `Street ${i + 1}`,
        city: "Kolkata",
        state: "WB",
        pincode: "700001",
        label: "HOME" as const,
        isDefault: i === 0,
      }));
      await User.updateOne(
        { _id: user._id },
        { $set: { addresses } },
      );

      const res = await request
        .post(`${API}/addresses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          street: "Extra Address",
          city: "Kolkata",
          state: "WB",
          pincode: "700001",
          label: "OTHER",
        });

      expectError(res, 400);
    });

    it("PATCH /addresses/:id returns 404 for a non-existent address", async () => {
      const { accessToken } = await createUserWithToken();
      const fakeId = "000000000000000000000000";

      const res = await request
        .patch(`${API}/addresses/${fakeId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ city: "Mumbai" });

      expectError(res, 404);
    });
  });
});