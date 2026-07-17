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

  it("reads and verifies a linked CNY to JPY FX transaction pair", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{
          id: "77777777-7777-4777-8777-777777777777",
          user_id: "11111111-1111-4111-8111-111111111111",
          transaction_type: "fx_out",
          account_id: "22222222-2222-4222-8222-222222222222",
          currency: "CNY",
          transacted_at: "2026-07-18",
          amount: "500.00",
          description: "人民币购汇转日元",
          note: "School 学费归集",
          linked_jpy_transaction_id: "88888888-8888-4888-8888-888888888888",
        }]), { status: 200, headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{
          id: "88888888-8888-4888-8888-888888888888",
          user_id: "11111111-1111-4111-8111-111111111111",
          transaction_type: "fx_in",
          account_id: "99999999-9999-4999-8999-999999999999",
          currency: "JPY",
          transacted_at: "2026-07-18",
          amount: "10000.00",
          description: "人民币购汇转日元",
          note: "School 学费归集",
          linked_cny_transaction_id: "77777777-7777-4777-8777-777777777777",
        }]), { status: 200, headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      buildGateway().getCnyToJpyFx("77777777-7777-4777-8777-777777777777"),
    ).resolves.toEqual({
      cnyTransactionId: "77777777-7777-4777-8777-777777777777",
      jpyTransactionId: "88888888-8888-4888-8888-888888888888",
      userId: "11111111-1111-4111-8111-111111111111",
      cnyAccountId: "22222222-2222-4222-8222-222222222222",
      jpyAccountId: "99999999-9999-4999-8999-999999999999",
      transactedAt: "2026-07-18",
      cnyAmount: 500,
      jpyAmount: 10000,
      description: "人民币购汇转日元",
      note: "School 学费归集",
    });
  });

  it("reads and verifies one aggregate teacher wage transaction and its request items", async () => {
    const batchId = "10101010-1010-4010-8010-101010101010";
    const transactionId = "20202020-2020-4020-8020-202020202020";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: batchId,
        user_id: "11111111-1111-4111-8111-111111111111",
        batch_type: "teacher_wage_payment",
        currency: "JPY",
        account_id: "22222222-2222-4222-8222-222222222222",
        transacted_at: "2026-07-18",
        total_amount: "7000.00",
        status: "approved",
        created_transaction_id: transactionId,
        teacher_id: "30303030-3030-4030-8030-303030303030",
        teacher_name: "测试老师",
        year_month: "2026-07",
        approved_at: "2026-07-18T03:00:00.000Z",
      }]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: "40404040-4040-4040-8040-404040404040",
          batch_id: batchId,
          request_id: "50505050-5050-4050-8050-505050505050",
          external_reference_id: "60606060-6060-4060-8060-606060606060",
          amount: "3000.00",
          item_order: 1,
        },
        {
          id: "70707070-7070-4070-8070-707070707070",
          batch_id: batchId,
          request_id: "80808080-8080-4080-8080-808080808080",
          external_reference_id: "90909090-9090-4090-8090-909090909090",
          amount: "4000.00",
          item_order: 2,
        },
      ]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: transactionId,
        user_id: "11111111-1111-4111-8111-111111111111",
        transaction_type: "expense",
        account_id: "22222222-2222-4222-8222-222222222222",
        currency: "JPY",
        transacted_at: "2026-07-18",
        amount: "7000.00",
        external_source: "aozora_school",
        external_source_id: batchId,
        external_event_type: "teacher_wage_batch_paid",
        external_reference_type: "school_expense_batches",
        external_reference_id: batchId,
        created_by_external: true,
      }]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(buildGateway().getTeacherWageBatch(batchId)).resolves.toMatchObject({
      id: batchId,
      totalAmount: 7000,
      createdTransactionId: transactionId,
      teacherName: "测试老师",
      yearMonth: "2026-07",
      items: [
        { amount: 3000, itemOrder: 1 },
        { amount: 4000, itemOrder: 2 },
      ],
    });
  });
});
