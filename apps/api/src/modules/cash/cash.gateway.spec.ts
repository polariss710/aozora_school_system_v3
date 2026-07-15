import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CashGatewayRequestError,
  SupabaseCashGateway,
} from "./cash.gateway";

function buildGateway() {
  return new SupabaseCashGateway({
    supabaseUrl: "https://cash.example.test",
    serviceRoleKey: "test-service-role",
    userId: "11111111-1111-4111-8111-111111111111",
    timeoutMs: 1_000,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SupabaseCashGateway", () => {
  it("reads only the configured user's School-eligible accounts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "日元现金",
            currency: "JPY",
            account_type: "cash",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await buildGateway().listEligibleAccounts();

    expect(accounts).toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "日元现金",
        currency: "JPY",
        accountType: "cash",
      },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("home_accounts");
    expect(url).toContain("user_id=eq.11111111-1111-4111-8111-111111111111");
    expect(url).toContain("allow_school_requests=is.true");
  });

  it("maps a V3 income attempt to the canonical Cash pending request RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          inserted: true,
          request_id: "33333333-3333-4333-8333-333333333333",
          status: "pending",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await buildGateway().createPendingRequest({
      localCashRequestId: "44444444-4444-4444-8444-444444444444",
      direction: "income",
      referenceId: "55555555-5555-4555-8555-555555555555",
      transactedAt: "2026-07-16",
      currency: "JPY",
      amount: 6000,
      accountId: "22222222-2222-4222-8222-222222222222",
      description: "2026-07 学费",
      note: null,
      payloadSnapshot: { schema_version: 1 },
    });

    expect(result).toEqual({
      requestId: "33333333-3333-4333-8333-333333333333",
      status: "pending",
      inserted: true,
      createdTransactionId: null,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      p_external_source: "aozora_school",
      p_external_event_id: "44444444-4444-4444-8444-444444444444",
      p_external_reference_type: "school_income_records",
      p_external_reference_id: "55555555-5555-4555-8555-555555555555",
      p_request_type: "income_received",
      p_transaction_type: "income",
      p_idempotency_key:
        "aozora-v3:cash-request:44444444-4444-4444-8444-444444444444",
    });
  });

  it("marks transport failures as uncertain without exposing credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const promise = buildGateway().createPendingRequest({
      localCashRequestId: "44444444-4444-4444-8444-444444444444",
      direction: "expense",
      referenceId: "55555555-5555-4555-8555-555555555555",
      transactedAt: "2026-07-16",
      currency: "CNY",
      amount: 100,
      accountId: "22222222-2222-4222-8222-222222222222",
      description: "工资",
      note: null,
      payloadSnapshot: {},
    });

    await expect(promise).rejects.toMatchObject<CashGatewayRequestError>({
      uncertain: true,
      message: "Cash request failed before a verified response was received.",
    });
  });
});
