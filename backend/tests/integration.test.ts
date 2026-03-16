import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let authToken: string;
  let userId: string;
  let groupId: string;
  let notificationId: string;

  // ========== Auth & User Setup ==========
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    expect(authToken).toBeDefined();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
  });

  // ========== User Endpoints ==========
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

  test("Update current user profile", async () => {
    const res = await authenticatedApi("/api/users/me", authToken, {
      method: "PUT",
      body: JSON.stringify({
        name: "Updated Test User",
        email: "testuser@example.com",
        avatarUrl: "https://example.com/avatar.png"
      })
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.user).toBeDefined();
  });

  test("Update user without authentication returns 401", async () => {
    const res = await api("/api/users/me", {
      method: "PUT",
      body: JSON.stringify({ name: "Hacker" })
    });
    await expectStatus(res, 401);
  });

  test("Search users by phone", async () => {
    const res = await authenticatedApi("/api/users/search?phone=%2B237", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
  });

  test("Search users without authentication returns 401", async () => {
    const res = await api("/api/users/search?phone=%2B237");
    await expectStatus(res, 401);
  });

  test("Set wallet PIN", async () => {
    const res = await authenticatedApi("/api/users/set-pin", authToken, {
      method: "POST",
      body: JSON.stringify({ pin: "1234" })
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Set PIN without authentication returns 401", async () => {
    const res = await api("/api/users/set-pin", {
      method: "POST",
      body: JSON.stringify({ pin: "5678" })
    });
    await expectStatus(res, 401);
  });

  test("Set PIN without required field returns 400", async () => {
    const res = await authenticatedApi("/api/users/set-pin", authToken, {
      method: "POST",
      body: JSON.stringify({})
    });
    await expectStatus(res, 400);
  });

  // ========== Wallet Endpoints ==========
  test("Get wallet balance", async () => {
    const res = await authenticatedApi("/api/wallet/balance", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.balance).toBeDefined();
    expect(typeof data.balance).toBe("number");
  });

  test("Get wallet balance without authentication returns 401", async () => {
    const res = await api("/api/wallet/balance");
    await expectStatus(res, 401);
  });

  test("Deposit to wallet", async () => {
    const res = await authenticatedApi("/api/wallet/deposit", authToken, {
      method: "POST",
      body: JSON.stringify({
        amount: 5000,
        paymentMethod: "mtn_momo",
        phoneNumber: "+237671234567"
      })
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.transaction).toBeDefined();
    expect(data.message).toBeDefined();
  });

  test("Deposit without authentication returns 401", async () => {
    const res = await api("/api/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({
        amount: 1000,
        paymentMethod: "mtn_momo",
        phoneNumber: "+237671234567"
      })
    });
    await expectStatus(res, 401);
  });

  test("Deposit without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/wallet/deposit", authToken, {
      method: "POST",
      body: JSON.stringify({ amount: 1000 })
    });
    await expectStatus(res, 400);
  });

  test("Get wallet transactions", async () => {
    const res = await authenticatedApi("/api/wallet/transactions", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.transactions).toBeDefined();
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(typeof data.page).toBe("number");
  });

  test("Get wallet transactions with pagination", async () => {
    const res = await authenticatedApi("/api/wallet/transactions?page=1&limit=10", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.transactions).toBeDefined();
  });

  test("Get wallet transactions without authentication returns 401", async () => {
    const res = await api("/api/wallet/transactions");
    await expectStatus(res, 401);
  });

  test("Withdraw from wallet", async () => {
    const res = await authenticatedApi("/api/wallet/withdraw", authToken, {
      method: "POST",
      body: JSON.stringify({
        amount: 1000,
        paymentMethod: "mtn_momo",
        phoneNumber: "+237671234567",
        pin: "1234"
      })
    });
    // May succeed or fail depending on balance/validation, but should not be 401
    const status = res.status;
    expect([200, 400, 409].includes(status)).toBe(true);
  });

  test("Withdraw without authentication returns 401", async () => {
    const res = await api("/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({
        amount: 1000,
        paymentMethod: "mtn_momo",
        phoneNumber: "+237671234567",
        pin: "1234"
      })
    });
    await expectStatus(res, 401);
  });

  test("Withdraw without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/wallet/withdraw", authToken, {
      method: "POST",
      body: JSON.stringify({ amount: 1000 })
    });
    await expectStatus(res, 400);
  });

  test("Send money to another user", async () => {
    const res = await authenticatedApi("/api/wallet/send", authToken, {
      method: "POST",
      body: JSON.stringify({
        recipientPhone: "+237671234567",
        amount: 500,
        pin: "1234",
        note: "Payment for lunch"
      })
    });
    // May succeed or fail depending on recipient/balance, but should not be 401
    const status = res.status;
    expect([200, 400, 404, 409].includes(status)).toBe(true);
  });

  test("Send money without authentication returns 401", async () => {
    const res = await api("/api/wallet/send", {
      method: "POST",
      body: JSON.stringify({
        recipientPhone: "+237671234567",
        amount: 500,
        pin: "1234"
      })
    });
    await expectStatus(res, 401);
  });

  test("Send money without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/wallet/send", authToken, {
      method: "POST",
      body: JSON.stringify({ amount: 500 })
    });
    await expectStatus(res, 400);
  });

  // ========== Group Endpoints ==========
  test("Create a group", async () => {
    const res = await authenticatedApi("/api/groups", authToken, {
      method: "POST",
      body: JSON.stringify({
        name: "Test Savings Group",
        description: "A test group for integration testing",
        contributionAmount: 1000,
        frequency: "weekly",
        maxMembers: 10,
        startDate: "2026-03-16",
        penaltyAmount: 100
      })
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.group).toBeDefined();
    groupId = data.group.id;
    expect(groupId).toBeDefined();
  });

  test("Create group without authentication returns 401", async () => {
    const res = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: "Hack Group",
        contributionAmount: 500,
        frequency: "monthly"
      })
    });
    await expectStatus(res, 401);
  });

  test("Create group without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/groups", authToken, {
      method: "POST",
      body: JSON.stringify({ name: "Incomplete Group" })
    });
    await expectStatus(res, 400);
  });

  test("Get all groups for authenticated user", async () => {
    const res = await authenticatedApi("/api/groups", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.groups).toBeDefined();
    expect(Array.isArray(data.groups)).toBe(true);
  });

  test("Get all groups without authentication returns 401", async () => {
    const res = await api("/api/groups");
    await expectStatus(res, 401);
  });

  test("Get specific group", async () => {
    const res = await authenticatedApi(`/api/groups/${groupId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.group).toBeDefined();
    expect(data.group.id).toBe(groupId);
  });

  test("Get non-existent group returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authenticatedApi(`/api/groups/${fakeId}`, authToken);
    await expectStatus(res, 404);
  });

  test("Get group without authentication returns 401", async () => {
    const res = await api(`/api/groups/${groupId}`);
    await expectStatus(res, 401);
  });

  test("Get group members", async () => {
    const res = await authenticatedApi(`/api/groups/${groupId}/members`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.members).toBeDefined();
    expect(Array.isArray(data.members)).toBe(true);
  });

  test("Get group members without authentication returns 401", async () => {
    const res = await api(`/api/groups/${groupId}/members`);
    await expectStatus(res, 401);
  });

  test("Join a group", async () => {
    const res = await authenticatedApi(`/api/groups/${groupId}/join`, authToken, {
      method: "POST"
    });
    // May return 200 if not already member, or other status if already member
    const status = res.status;
    expect([200, 409, 400].includes(status)).toBe(true);
  });

  test("Join non-existent group returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authenticatedApi(`/api/groups/${fakeId}/join`, authToken, {
      method: "POST"
    });
    await expectStatus(res, 404);
  });

  test("Join group without authentication returns 401", async () => {
    const res = await api(`/api/groups/${groupId}/join`, {
      method: "POST"
    });
    await expectStatus(res, 401);
  });

  // ========== Contribution Endpoints ==========
  test("Create a contribution", async () => {
    const res = await authenticatedApi("/api/contributions", authToken, {
      method: "POST",
      body: JSON.stringify({
        groupId: groupId,
        amount: 1000,
        paymentMethod: "mtn_momo"
      })
    });
    // May succeed or fail depending on group state, but should not be 401
    const status = res.status;
    expect([201, 400, 409].includes(status)).toBe(true);
  });

  test("Create contribution without authentication returns 401", async () => {
    const res = await api("/api/contributions", {
      method: "POST",
      body: JSON.stringify({
        groupId: groupId,
        amount: 1000,
        paymentMethod: "mtn_momo"
      })
    });
    await expectStatus(res, 401);
  });

  test("Create contribution without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/contributions", authToken, {
      method: "POST",
      body: JSON.stringify({ groupId: groupId })
    });
    await expectStatus(res, 400);
  });

  test("Get contributions for a group", async () => {
    const res = await authenticatedApi(`/api/contributions?groupId=${groupId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.contributions).toBeDefined();
    expect(Array.isArray(data.contributions)).toBe(true);
  });

  test("Get all contributions without groupId filter", async () => {
    const res = await authenticatedApi("/api/contributions", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.contributions).toBeDefined();
    expect(Array.isArray(data.contributions)).toBe(true);
  });

  test("Get contributions without authentication returns 401", async () => {
    const res = await api("/api/contributions");
    await expectStatus(res, 401);
  });

  // ========== Notification Endpoints ==========
  test("Get all notifications", async () => {
    const res = await authenticatedApi("/api/notifications", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.notifications).toBeDefined();
    expect(Array.isArray(data.notifications)).toBe(true);
    if (data.notifications.length > 0) {
      notificationId = data.notifications[0].id;
    }
  });

  test("Get notifications without authentication returns 401", async () => {
    const res = await api("/api/notifications");
    await expectStatus(res, 401);
  });

  test("Mark notification as read", async () => {
    // Only test if we have a notification ID from the previous test
    if (notificationId) {
      const res = await authenticatedApi(`/api/notifications/${notificationId}/read`, authToken, {
        method: "POST"
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    }
  });

  test("Mark non-existent notification as read returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authenticatedApi(`/api/notifications/${fakeId}/read`, authToken, {
      method: "POST"
    });
    await expectStatus(res, 404);
  });

  test("Mark notification as read without authentication returns 401", async () => {
    const testId = "00000000-0000-0000-0000-000000000000";
    const res = await api(`/api/notifications/${testId}/read`, {
      method: "POST"
    });
    await expectStatus(res, 401);
  });
});
