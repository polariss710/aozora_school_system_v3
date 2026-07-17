import { ServiceUnavailableException } from "@nestjs/common";

export const CASH_GATEWAY = Symbol("CASH_GATEWAY");

export type CashIntegrationMode = "mock" | "supabase" | "disabled";
export type CashCurrency = "JPY" | "CNY";

export type CashEligibleAccount = {
  id: string;
  name: string;
  currency: CashCurrency;
  accountType: string;
};

export type CreateCashPendingRequestInput = {
  localCashRequestId: string;
  direction: "income" | "expense";
  referenceId: string;
  transactedAt: string;
  currency: CashCurrency;
  amount: number;
  accountId: string;
  description: string;
  note: string | null;
  payloadSnapshot: Record<string, unknown>;
};

export type CreateCashPendingRequestResult = {
  requestId: string;
  status: "pending" | "approved" | "rejected";
  inserted: boolean;
  createdTransactionId: string | null;
};

export type CashExternalRequest = {
  id: string;
  userId: string;
  externalSource: string;
  externalEventId: string;
  externalReferenceType: string;
  externalReferenceId: string;
  requestType: string;
  transactionType: string;
  currency: CashCurrency;
  amount: number;
  accountId: string;
  transactedAt: string;
  status: "pending" | "approved" | "rejected";
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdTransactionId: string | null;
};

export type CashCnyToJpyFx = {
  cnyTransactionId: string;
  jpyTransactionId: string;
  userId: string;
  cnyAccountId: string;
  jpyAccountId: string;
  transactedAt: string;
  cnyAmount: number;
  jpyAmount: number;
  description: string;
  note: string;
};

export interface CashGateway {
  readonly mode: CashIntegrationMode;
  listEligibleAccounts(): Promise<CashEligibleAccount[]>;
  createPendingRequest(
    input: CreateCashPendingRequestInput,
  ): Promise<CreateCashPendingRequestResult>;
  verifyCallbackAccessToken(token: string): Promise<{ userId: string }>;
  getExternalRequest(id: string): Promise<CashExternalRequest>;
  getCnyToJpyFx(cnyTransactionId: string): Promise<CashCnyToJpyFx>;
}

type SupabaseCashGatewayConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  timeoutMs: number;
};

type CashRpcResult = {
  ok?: boolean;
  inserted?: boolean;
  request_id?: string;
  status?: string;
  created_transaction_id?: string | null;
  message?: string;
};

type CashAccountRow = {
  id: string;
  name: string;
  currency: string;
  account_type: string;
};

type CashRequestRow = {
  id: string;
  user_id: string;
  external_source: string;
  external_event_id: string;
  external_reference_type: string;
  external_reference_id: string;
  request_type: string;
  transaction_type: string;
  currency: string;
  amount: number | string;
  account_id: string;
  transacted_at: string;
  status: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  created_transaction_id: string | null;
};

type CashCnyTransactionRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  account_id: string;
  currency: string;
  transacted_at: string;
  amount: number | string;
  description: string;
  note: string;
  linked_jpy_transaction_id: string | null;
};

type CashJpyTransactionRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  account_id: string;
  currency: string;
  transacted_at: string;
  amount: number | string;
  description: string;
  note: string;
  linked_cny_transaction_id: string | null;
};

export class CashGatewayRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain: boolean,
  ) {
    super(message);
  }
}

class MockCashGateway implements CashGateway {
  readonly mode = "mock" as const;

  async listEligibleAccounts() {
    return [
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Mock 日元现金",
        currency: "JPY" as const,
        accountType: "mock",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Mock 人民币账户",
        currency: "CNY" as const,
        accountType: "mock",
      },
    ];
  }

  async createPendingRequest(
    _input: CreateCashPendingRequestInput,
  ): Promise<CreateCashPendingRequestResult> {
    throw new Error("Mock Cash requests stay local and do not call a gateway.");
  }

  async verifyCallbackAccessToken(_token: string): Promise<{ userId: string }> {
    throw new ServiceUnavailableException("Cash callback is disabled in mock mode.");
  }

  async getExternalRequest(_id: string): Promise<CashExternalRequest> {
    throw new ServiceUnavailableException("Cash callback is disabled in mock mode.");
  }

  async getCnyToJpyFx(_cnyTransactionId: string): Promise<CashCnyToJpyFx> {
    throw new ServiceUnavailableException("Cash callback is disabled in mock mode.");
  }
}

class DisabledCashGateway implements CashGateway {
  readonly mode = "disabled" as const;

  async listEligibleAccounts() {
    return [];
  }

  async createPendingRequest(
    _input: CreateCashPendingRequestInput,
  ): Promise<CreateCashPendingRequestResult> {
    throw new ServiceUnavailableException("Cash integration is disabled.");
  }

  async verifyCallbackAccessToken(_token: string): Promise<{ userId: string }> {
    throw new ServiceUnavailableException("Cash integration is disabled.");
  }

  async getExternalRequest(_id: string): Promise<CashExternalRequest> {
    throw new ServiceUnavailableException("Cash integration is disabled.");
  }

  async getCnyToJpyFx(_cnyTransactionId: string): Promise<CashCnyToJpyFx> {
    throw new ServiceUnavailableException("Cash integration is disabled.");
  }
}

export class SupabaseCashGateway implements CashGateway {
  readonly mode = "supabase" as const;

  constructor(private readonly config: SupabaseCashGatewayConfig) {}

  async listEligibleAccounts(): Promise<CashEligibleAccount[]> {
    const query = new URLSearchParams({
      select: "id,name,currency,account_type",
      user_id: `eq.${this.config.userId}`,
      is_active: "is.true",
      allow_school_requests: "is.true",
      order: "currency.asc,sort_order.asc,name.asc",
    });
    const rows = await this.request<CashAccountRow[]>(
      `/rest/v1/home_accounts?${query.toString()}`,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      currency: this.requireCurrency(row.currency),
      accountType: row.account_type,
    }));
  }

  async createPendingRequest(
    input: CreateCashPendingRequestInput,
  ): Promise<CreateCashPendingRequestResult> {
    const isIncome = input.direction === "income";
    const result = await this.request<CashRpcResult>(
      "/rest/v1/rpc/home_create_external_transaction_request",
      {
        method: "POST",
        body: JSON.stringify({
          p_user_id: this.config.userId,
          p_account_id: input.accountId,
          p_external_source: "aozora_school",
          p_external_event_id: input.localCashRequestId,
          p_external_reference_type: isIncome
            ? "school_income_records"
            : "school_expense_records",
          p_external_reference_id: input.referenceId,
          p_request_type: isIncome ? "income_received" : "expense_paid",
          p_transaction_type: input.direction,
          p_transacted_at: input.transactedAt,
          p_amount: input.amount,
          p_idempotency_key: `aozora-v3:cash-request:${input.localCashRequestId}`,
          p_description: input.description,
          p_note: input.note ?? "",
          p_payload_snapshot: input.payloadSnapshot,
          p_currency: input.currency,
        }),
      },
    );

    if (!result.ok || !result.request_id) {
      throw new CashGatewayRequestError(
        this.safeMessage(result.message ?? "Cash pending request was not created."),
        false,
      );
    }

    if (!this.isRequestStatus(result.status)) {
      throw new CashGatewayRequestError("Cash returned an invalid request status.", false);
    }

    return {
      requestId: result.request_id,
      status: result.status,
      inserted: result.inserted === true,
      createdTransactionId: result.created_transaction_id ?? null,
    };
  }

  async verifyCallbackAccessToken(token: string): Promise<{ userId: string }> {
    const user = await this.request<{ id?: string }>("/auth/v1/user", {
      headers: { authorization: `Bearer ${token}` },
    });

    if (!user.id || user.id !== this.config.userId) {
      throw new CashGatewayRequestError("Cash callback user is not allowed.", false);
    }

    return { userId: user.id };
  }

  async getExternalRequest(id: string): Promise<CashExternalRequest> {
    const query = new URLSearchParams({
      select: [
        "id",
        "user_id",
        "external_source",
        "external_event_id",
        "external_reference_type",
        "external_reference_id",
        "request_type",
        "transaction_type",
        "currency",
        "amount",
        "account_id",
        "transacted_at",
        "status",
        "approved_at",
        "rejected_at",
        "rejected_reason",
        "created_transaction_id",
      ].join(","),
      id: `eq.${id}`,
      user_id: `eq.${this.config.userId}`,
      limit: "1",
    });
    const rows = await this.request<CashRequestRow[]>(
      `/rest/v1/home_external_transaction_requests?${query.toString()}`,
    );
    const row = rows[0];

    if (!row) {
      throw new CashGatewayRequestError("Cash request was not found.", false);
    }
    if (!this.isRequestStatus(row.status)) {
      throw new CashGatewayRequestError("Cash request has an invalid status.", false);
    }

    return {
      id: row.id,
      userId: row.user_id,
      externalSource: row.external_source,
      externalEventId: row.external_event_id,
      externalReferenceType: row.external_reference_type,
      externalReferenceId: row.external_reference_id,
      requestType: row.request_type,
      transactionType: row.transaction_type,
      currency: this.requireCurrency(row.currency),
      amount: Number(row.amount),
      accountId: row.account_id,
      transactedAt: row.transacted_at,
      status: row.status,
      approvedAt: row.approved_at,
      rejectedAt: row.rejected_at,
      rejectedReason: row.rejected_reason,
      createdTransactionId: row.created_transaction_id,
    };
  }

  async getCnyToJpyFx(cnyTransactionId: string): Promise<CashCnyToJpyFx> {
    const cnyQuery = new URLSearchParams({
      select: [
        "id",
        "user_id",
        "transaction_type",
        "account_id",
        "currency",
        "transacted_at",
        "amount",
        "description",
        "note",
        "linked_jpy_transaction_id",
      ].join(","),
      id: `eq.${cnyTransactionId}`,
      user_id: `eq.${this.config.userId}`,
      transaction_type: "eq.fx_out",
      limit: "1",
    });
    const cnyRows = await this.request<CashCnyTransactionRow[]>(
      `/rest/v1/home_cny_transactions?${cnyQuery.toString()}`,
    );
    const cny = cnyRows[0];
    if (!cny?.linked_jpy_transaction_id) {
      throw new CashGatewayRequestError("Cash CNY to JPY FX transaction was not found.", false);
    }

    const jpyQuery = new URLSearchParams({
      select: [
        "id",
        "user_id",
        "transaction_type",
        "account_id",
        "currency",
        "transacted_at",
        "amount",
        "description",
        "note",
        "linked_cny_transaction_id",
      ].join(","),
      id: `eq.${cny.linked_jpy_transaction_id}`,
      user_id: `eq.${this.config.userId}`,
      transaction_type: "eq.fx_in",
      limit: "1",
    });
    const jpyRows = await this.request<CashJpyTransactionRow[]>(
      `/rest/v1/home_jpy_transactions?${jpyQuery.toString()}`,
    );
    const jpy = jpyRows[0];
    if (!jpy || jpy.linked_cny_transaction_id !== cny.id) {
      throw new CashGatewayRequestError("Cash FX transaction pair is incomplete.", false);
    }
    if (
      cny.user_id !== this.config.userId ||
      jpy.user_id !== this.config.userId ||
      cny.currency !== "CNY" ||
      jpy.currency !== "JPY" ||
      cny.transacted_at !== jpy.transacted_at
    ) {
      throw new CashGatewayRequestError("Cash FX transaction pair is inconsistent.", false);
    }

    const cnyAmount = Number(cny.amount);
    const jpyAmount = Number(jpy.amount);
    if (!Number.isFinite(cnyAmount) || cnyAmount <= 0 || !Number.isFinite(jpyAmount) || jpyAmount <= 0) {
      throw new CashGatewayRequestError("Cash FX transaction amount is invalid.", false);
    }

    return {
      cnyTransactionId: cny.id,
      jpyTransactionId: jpy.id,
      userId: cny.user_id,
      cnyAccountId: cny.account_id,
      jpyAccountId: jpy.account_id,
      transactedAt: cny.transacted_at,
      cnyAmount,
      jpyAmount,
      description: cny.description,
      note: cny.note,
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.supabaseUrl}${path}`, {
        ...init,
        headers: {
          apikey: this.config.serviceRoleKey,
          authorization: `Bearer ${this.config.serviceRoleKey}`,
          "content-type": "application/json",
          ...init.headers,
        },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error_description?: string }
        | T
        | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object"
            ? (payload as { message?: string; error_description?: string }).message ??
              (payload as { error_description?: string }).error_description
            : null;
        throw new CashGatewayRequestError(
          this.safeMessage(message ?? `Cash request failed with HTTP ${response.status}.`),
          false,
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof CashGatewayRequestError) {
        throw error;
      }

      const message = error instanceof Error && error.name === "AbortError"
        ? "Cash request timed out."
        : "Cash request failed before a verified response was received.";
      throw new CashGatewayRequestError(message, true);
    } finally {
      clearTimeout(timeout);
    }
  }

  private requireCurrency(value: string): CashCurrency {
    if (value !== "JPY" && value !== "CNY") {
      throw new CashGatewayRequestError("Cash returned an unsupported currency.", false);
    }
    return value;
  }

  private isRequestStatus(
    value: string | undefined,
  ): value is "pending" | "approved" | "rejected" {
    return value === "pending" || value === "approved" || value === "rejected";
  }

  private safeMessage(message: string) {
    return message.replace(/(Bearer|apikey|service_role)\s+[^\s]+/gi, "$1 [redacted]").slice(0, 500);
  }
}

export function createCashGatewayFromEnv(): CashGateway {
  const runtimeEnv = (process.env.SCHOOL_RUNTIME_ENV?.trim().toLowerCase() || "dev");
  if (!["dev", "staging", "prod"].includes(runtimeEnv)) {
    throw new Error("SCHOOL_RUNTIME_ENV must be dev, staging, or prod.");
  }

  const requestedMode = process.env.CASH_INTEGRATION_MODE?.trim().toLowerCase();
  const mode = requestedMode || (runtimeEnv === "dev" ? "mock" : "disabled");

  if (mode === "mock") {
    if (runtimeEnv !== "dev") {
      throw new Error("Cash mock mode is allowed only in the dev runtime.");
    }
    return new MockCashGateway();
  }

  if (mode === "disabled") {
    return new DisabledCashGateway();
  }

  if (mode !== "supabase") {
    throw new Error("CASH_INTEGRATION_MODE must be mock, supabase, or disabled.");
  }

  const prefix = `CASH_${runtimeEnv.toUpperCase()}`;
  const supabaseUrl = process.env[`${prefix}_SUPABASE_URL`]?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env[`${prefix}_SERVICE_ROLE_KEY`]?.trim();
  const userId = process.env[`${prefix}_USER_ID`]?.trim();
  if (!supabaseUrl || !serviceRoleKey || !userId) {
    throw new Error(
      `${prefix}_SUPABASE_URL, ${prefix}_SERVICE_ROLE_KEY, and ${prefix}_USER_ID are required in supabase mode.`,
    );
  }

  return new SupabaseCashGateway({
    supabaseUrl,
    serviceRoleKey,
    userId,
    timeoutMs: 10_000,
  });
}
