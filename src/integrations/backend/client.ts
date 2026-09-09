const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SESSION_KEY = "knj_ia_session_v1";

type AppUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, any>;
};

type AppSession = {
  access_token: string;
  token_type: "bearer";
  user: AppUser;
};

type ApiError = { message: string; status?: number; details?: unknown };

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED" | "INITIAL_SESSION";
type AuthListener = (event: AuthEvent, session: AppSession | null) => void;

function readSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || !parsed?.user?.id) return null;
    return parsed as AppSession;
  } catch {
    return null;
  }
}

let currentSession: AppSession | null = typeof window !== "undefined" ? readSession() : null;
const authListeners = new Set<AuthListener>();

function saveSession(session: AppSession | null) {
  currentSession = session;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage disabled */ }
}

function emitAuth(event: AuthEvent) {
  for (const listener of authListeners) {
    try { listener(event, currentSession); } catch (error) { console.warn("auth listener failed", error); }
  }
}

async function request(path: string, init: RequestInit = {}, explicitToken?: string | null) {
  const token = explicitToken === undefined ? currentSession?.access_token : explicitToken;
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  let body: any;
  if (contentType.includes("application/json")) body = await response.json().catch(() => ({}));
  else body = await response.text();
  if (!response.ok) {
    const error: ApiError = {
      message: typeof body === "object" && body?.error ? String(body.error) : `HTTP ${response.status}`,
      status: response.status,
      details: typeof body === "object" ? body?.details : undefined,
    };
    throw error;
  }
  return body;
}

function asError(error: unknown): ApiError {
  if (error && typeof error === "object" && "message" in error) return error as ApiError;
  return { message: String(error) };
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const data = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, null);
      const session: AppSession = { access_token: data.token, token_type: "bearer", user: data.user };
      saveSession(session);
      emitAuth("SIGNED_IN");
      return { data: { user: session.user, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: asError(error) };
    }
  },

  async signUp({ email, password, options }: any) {
    try {
      const metadata = options?.data || {};
      const data = await request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name: metadata.display_name, whatsapp: metadata.whatsapp }),
      }, null);
      const session: AppSession = { access_token: data.token, token_type: "bearer", user: data.user };
      saveSession(session);
      emitAuth("SIGNED_IN");
      return { data: { user: session.user, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: asError(error) };
    }
  },

  async getSession() {
    if (!currentSession) return { data: { session: null }, error: null };
    try {
      const data = await request("/api/auth/me", { method: "GET" });
      currentSession = { ...currentSession, user: data.user };
      saveSession(currentSession);
      return { data: { session: currentSession }, error: null };
    } catch (error: any) {
      if (error?.status === 401) {
        saveSession(null);
        emitAuth("SIGNED_OUT");
        return { data: { session: null }, error: null };
      }
      return { data: { session: currentSession }, error: asError(error) };
    }
  },

  async getUser() {
    const result = await auth.getSession();
    return { data: { user: result.data.session?.user || null }, error: result.error };
  },

  async signOut() {
    try { await request("/api/auth/logout", { method: "POST" }); } catch { /* local logout still applies */ }
    saveSession(null);
    emitAuth("SIGNED_OUT");
    return { error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    authListeners.add(callback);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },
};

type Filter = { column: string; op: string; value?: any; operator?: string };
type Order = { column: string; ascending: boolean };

type QueryResult = { data: any; error: ApiError | null; count?: number | null };

function parseValue(raw: string) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private table: string;
  private action = "select";
  private selectValue = "*";
  private payload: any = undefined;
  private filters: Filter[] = [];
  private orGroups: Filter[][] = [];
  private orders: Order[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private countValue: string | null = null;
  private head = false;
  private onConflict: string | null = null;
  private cardinality: "many" | "single" | "maybeSingle" = "many";

  constructor(table: string) { this.table = table; }

  select(columns = "*", options: any = {}) {
    this.selectValue = columns;
    this.countValue = options?.count || this.countValue;
    this.head = !!options?.head;
    return this;
  }
  insert(payload: any) { this.action = "insert"; this.payload = payload; return this; }
  update(payload: any) { this.action = "update"; this.payload = payload; return this; }
  upsert(payload: any, options: any = {}) { this.action = "upsert"; this.payload = payload; this.onConflict = options?.onConflict || null; return this; }
  delete() { this.action = "delete"; return this; }
  eq(column: string, value: any) { this.filters.push({ column, op: "eq", value }); return this; }
  neq(column: string, value: any) { this.filters.push({ column, op: "neq", value }); return this; }
  gt(column: string, value: any) { this.filters.push({ column, op: "gt", value }); return this; }
  gte(column: string, value: any) { this.filters.push({ column, op: "gte", value }); return this; }
  lt(column: string, value: any) { this.filters.push({ column, op: "lt", value }); return this; }
  lte(column: string, value: any) { this.filters.push({ column, op: "lte", value }); return this; }
  like(column: string, value: any) { this.filters.push({ column, op: "like", value }); return this; }
  ilike(column: string, value: any) { this.filters.push({ column, op: "ilike", value }); return this; }
  is(column: string, value: any) { this.filters.push({ column, op: "is", value }); return this; }
  in(column: string, values: any[]) { this.filters.push({ column, op: "in", value: values }); return this; }
  contains(column: string, value: any) { this.filters.push({ column, op: "contains", value }); return this; }
  not(column: string, operator: string, value: any) { this.filters.push({ column, op: "not", operator, value }); return this; }
  filter(column: string, operator: string, value: any) { this.filters.push({ column, op: operator, value }); return this; }
  match(values: Record<string, any>) { Object.entries(values || {}).forEach(([column, value]) => this.eq(column, value)); return this; }
  or(expression: string) {
    const group: Filter[] = [];
    for (const clause of String(expression || "").split(",")) {
      const parts = clause.trim().split(".");
      if (parts.length < 3) continue;
      const [column, op, ...rest] = parts;
      let raw = rest.join(".");
      if (op === "in" && raw.startsWith("(") && raw.endsWith(")")) {
        group.push({ column, op, value: raw.slice(1, -1).split(",").map((v) => parseValue(v.trim())) });
      } else group.push({ column, op, value: parseValue(raw) });
    }
    if (group.length) this.orGroups.push(group);
    return this;
  }
  order(column: string, options: any = {}) { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.limitValue = value; return this; }
  range(from: number, to: number) { this.offsetValue = Math.max(0, from); this.limitValue = Math.max(0, to - from + 1); return this; }
  single() { this.cardinality = "single"; return this.execute(); }
  maybeSingle() { this.cardinality = "maybeSingle"; return this.execute(); }

  private async execute(): Promise<QueryResult> {
    try {
      const response = await request("/api/data", {
        method: "POST",
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          select: this.selectValue,
          payload: this.payload,
          filters: this.filters,
          orGroups: this.orGroups,
          order: this.orders,
          limit: this.limitValue,
          offset: this.offsetValue,
          count: this.countValue,
          onConflict: this.onConflict,
        }),
      });
      let data = response?.data ?? [];
      if (this.cardinality === "single") {
        if (!Array.isArray(data) || data.length !== 1) return { data: null, error: { message: data?.length ? "Multiple rows returned" : "No rows returned" }, count: response?.count ?? null };
        data = data[0];
      } else if (this.cardinality === "maybeSingle") {
        if (!Array.isArray(data) || data.length > 1) return { data: null, error: { message: "Multiple rows returned" }, count: response?.count ?? null };
        data = data[0] ?? null;
      }
      if (this.head) data = null;
      return { data, error: null, count: response?.count ?? null };
    } catch (error) {
      return { data: null, error: asError(error), count: null };
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const functions = {
  async invoke(name: string, options: any = {}) {
    try {
      const headers = new Headers(options?.headers || {});
      const explicit = headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || undefined;
      if (headers.has("Authorization")) headers.delete("Authorization");
      const data = await request(`/api/functions/${encodeURIComponent(name)}`, {
        method: "POST",
        headers,
        body: JSON.stringify(options?.body || {}),
      }, explicit);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: asError(error) };
    }
  },
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function publicObjectUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/api/storage/object/${encodeURIComponent(bucket)}/${encodedPath}`;
}

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File, options: any = {}) {
        try {
          const start = await request("/api/storage/start", {
            method: "POST",
            body: JSON.stringify({ bucket, path, contentType: options?.contentType || file.type || "application/octet-stream", size: file.size }),
          });
          const partSize = 512 * 1024;
          let partNo = 0;
          for (let offset = 0; offset < file.size; offset += partSize) {
            const bytes = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + partSize)).arrayBuffer());
            await request("/api/storage/part", {
              method: "POST",
              body: JSON.stringify({ uploadId: start.uploadId, partNo, base64: bytesToBase64(bytes) }),
            });
            partNo++;
          }
          const data = await request("/api/storage/finish", { method: "POST", body: JSON.stringify({ uploadId: start.uploadId }) });
          return { data, error: null };
        } catch (error) {
          return { data: null, error: asError(error) };
        }
      },
      getPublicUrl(path: string) { return { data: { publicUrl: publicObjectUrl(bucket, path) } }; },
      async remove(paths: string[]) {
        try {
          const response = await request("/api/storage/remove", { method: "POST", body: JSON.stringify({ bucket, paths }) });
          return { data: response?.data || [], error: null };
        } catch (error) { return { data: null, error: asError(error) }; }
      },
    };
  },
};

class NoopChannel {
  on() { return this; }
  subscribe() { return this; }
  unsubscribe() { return Promise.resolve("ok"); }
}

export const supabase = {
  auth,
  functions,
  storage,
  from(table: string) { return new QueryBuilder(table); },
  async rpc(name: string, args: any = {}) {
    try {
      const response = await request(`/api/rpc/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify(args || {}) });
      return { data: response?.data ?? null, error: null };
    } catch (error) { return { data: null, error: asError(error) }; }
  },
  channel(_name: string) { return new NoopChannel(); },
  async removeChannel(channel: any) { try { await channel?.unsubscribe?.(); } catch { /* noop */ } return "ok"; },
};

export type { AppUser, AppSession, ApiError };
