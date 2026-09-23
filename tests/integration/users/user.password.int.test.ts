import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { User } from "@modules/users/user.model";
import { redisClient } from "@config/redis";

const API = "/api/v1/users/profile/security/password";

describe("Password Change — step-up OTP flow", () => {
  it("POST /otp generates a 6-digit OTP in Redis", async () => {
    const { user, accessToken } = await createUserWithToken();

    const res = await request
      .post(`${API}/otp`)
      .set("Authorization", `Bearer ${accessToken}`);

    expectSuccess(res, 200);

    const otp = await redisClient.get(`pwd_update_otp:${user._id}`);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("PATCH / changes the password with a valid OTP + current password", async () => {
    const { user, accessToken, plainPassword } = await createUserWithToken();

    // Request OTP
    await request
      .post(`${API}/otp`)
      .set("Authorization", `Bearer ${accessToken}`);

    const otp = (await redisClient.get(`pwd_update_otp:${user._id}`))!;

    const res = await request
      .patch(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        otp,
        currentPassword: plainPassword,
        newPassword: "NewPassword123!",
      });

    expectSuccess(res, 200);

    // Verify the new password works via direct DB comparison
    const refreshed = await User.findById(user._id).select("+password");
    const match = await refreshed!.comparePassword("NewPassword123!");
    expect(match).toBe(true);
  });

  it("rejects an invalid OTP", async () => {
    const { accessToken, plainPassword } = await createUserWithToken();

    const res = await request
      .patch(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        otp: "000000",
        currentPassword: plainPassword,
        newPassword: "NewPassword123!",
      });

    expectError(res, 401);
  });

  it("rejects an incorrect current password", async () => {
    const { user, accessToken } = await createUserWithToken();

    await request
      .post(`${API}/otp`)
      .set("Authorization", `Bearer ${accessToken}`);
    const otp = (await redisClient.get(`pwd_update_otp:${user._id}`))!;

    const res = await request
      .patch(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        otp,
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!",
      });

    expectError(res, 401);
  });

  it("rejects a weak new password (Zod)", async () => {
    const { user, accessToken, plainPassword } = await createUserWithToken();

    await request
      .post(`${API}/otp`)
      .set("Authorization", `Bearer ${accessToken}`);
    const otp = (await redisClient.get(`pwd_update_otp:${user._id}`))!;

    const res = await request
      .patch(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        otp,
        currentPassword: plainPassword,
        newPassword: "weak",
      });

    expectError(res, 400);
  });
});
