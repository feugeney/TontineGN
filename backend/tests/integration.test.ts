import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;

  // Set up authenticated user for subsequent tests
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
  });

  // Users endpoint tests (authenticated)
  test("Get current user with authentication", async () => {
    const res = await authenticatedApi("/api/users/me", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.phone).toBeDefined();
  });

  test("Get current user without authentication returns 401", async () => {
    const res = await api("/api/users/me");
    await expectStatus(res, 401);
  });
});
