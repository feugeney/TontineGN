import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;

  // OTP endpoint tests
  test("Send OTP to phone number", async () => {
    const res = await api("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1234567890" }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBeDefined();
    expect(data.message).toBeDefined();
    expect(data.expires_in).toBeDefined();
  });

  test("OTP send fails without phone field", async () => {
    const res = await api("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("OTP verify fails without phone field", async () => {
    const res = await api("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    });
    await expectStatus(res, 400);
  });

  test("OTP verify fails without code field", async () => {
    const res = await api("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1234567890" }),
    });
    await expectStatus(res, 400);
  });

  test("OTP verify with phone and code", async () => {
    const res = await api("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1234567890", code: "000000", name: "Test User" }),
    });
    // Accept 200 (valid code) or 400 (invalid code)
    await expectStatus(res, 200, 400);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.is_new_user).toBeDefined();
    }
  });

  // Users endpoint tests (authenticated)
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
  });

  test("Get current user with authentication", async () => {
    const res = await authenticatedApi("/api/users/me", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBeDefined();
    expect(data.user.phone).toBeDefined();
  });

  test("Get current user without authentication returns 401", async () => {
    const res = await api("/api/users/me");
    await expectStatus(res, 401);
  });
});
