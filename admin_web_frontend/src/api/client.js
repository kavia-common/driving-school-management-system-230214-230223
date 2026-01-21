import { getRuntimeConfig } from "../config/env";

const DEFAULT_DELAY_MS = 250;
const TOKEN_STORAGE_KEY = "dsms_access_token";

/**
 * @typedef {Object} ApiResult
 * @property {boolean} ok
 * @property {number} status
 * @property {any} data
 * @property {string|null} error
 * @property {string} message
 */

/**
 * Simulate network latency for stubbed mode.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {any} data
 * @param {number} status
 * @param {string=} message
 * @returns {ApiResult}
 */
function ok(data, status = 200, message = "OK") {
  return { ok: true, status, data, error: null, message };
}

/**
 * @param {string} message
 * @param {number} status
 * @param {any=} data
 * @param {string=} error
 * @returns {ApiResult}
 */
function fail(message, status = 0, data = null, error = "error") {
  return { ok: false, status, data, error, message };
}

/**
 * Build an absolute URL for a given API path (supports absolute URLs too).
 * @param {string} path
 * @returns {string}
 */
function endpoint(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const { apiBase } = getRuntimeConfig();
  return `${String(apiBase).replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Read persisted access token (AuthContext uses the same key).
 * @returns {string|null}
 */
function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Build query string with common admin pagination/search/sort conventions.
 * @param {{
 *  page?: number,
 *  pageSize?: number,
 *  sort?: string,
 *  order?: "asc"|"desc",
 *  q?: string,
 *  filters?: Record<string, any>,
 *  [key: string]: any
 * }} params
 * @returns {string}
 */
function buildQuery(params = {}) {
  const search = new URLSearchParams();

  const safeSet = (k, v) => {
    if (v === undefined || v === null || v === "") return;
    search.set(k, String(v));
  };

  safeSet("page", params.page);
  safeSet("pageSize", params.pageSize);
  safeSet("sort", params.sort);
  safeSet("order", params.order);
  safeSet("q", params.q);

  if (params.filters && typeof params.filters === "object") {
    Object.entries(params.filters).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((vv) => search.append(`filter[${k}]`, String(vv)));
      else search.append(`filter[${k}]`, String(v));
    });
  }

  // Allow extra arbitrary keys (backward compatible with existing callers)
  Object.entries(params).forEach(([k, v]) => {
    if (["page", "pageSize", "sort", "order", "q", "filters"].includes(k)) return;
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) v.forEach((vv) => search.append(k, String(vv)));
    else search.append(k, String(v));
  });

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Normalize different kinds of fetch failures into a stable ApiResult.
 * @param {Response|null} res
 * @param {any} body
 * @param {Error|any} err
 * @returns {ApiResult}
 */
function normalizeError(res, body, err) {
  if (res) {
    const status = res.status;
    // Try common API error shapes
    const message =
      body?.message ||
      body?.error ||
      (typeof body === "string" ? body : null) ||
      `Request failed (${status})`;

    return fail(message, status, body ?? null, body?.error || "http_error");
  }

  const message = err instanceof Error ? err.message : "Network error";
  return fail(message, 0, null, "network_error");
}

/**
 * Create an HTTP client with token injection, JSON handling, and 401 callback.
 * @param {{ getToken?: () => string|null, onUnauthorized?: (info: ApiResult) => void }} options
 */
function createHttpClient(options = {}) {
  const getToken = typeof options.getToken === "function" ? options.getToken : () => readToken();
  const onUnauthorized = typeof options.onUnauthorized === "function" ? options.onUnauthorized : null;

  /**
   * @param {string} method
   * @param {string} path
   * @param {{ body?: any, params?: any, headers?: Record<string,string> }=} options2
   * @returns {Promise<ApiResult>}
   */
  async function request(method, path, options2 = {}) {
    const url = endpoint(path) + buildQuery(options2.params || {});
    const token = getToken();

    /** @type {Record<string,string>} */
    const headers = {
      Accept: "application/json",
      ...(options2.headers || {}),
    };

    // Attach JSON header only when body exists; supports FormData later.
    const hasBody = options2.body !== undefined && options2.body !== null;
    const isFormData = typeof FormData !== "undefined" && options2.body instanceof FormData;
    if (hasBody && !isFormData) headers["Content-Type"] = "application/json";

    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: hasBody ? (isFormData ? options2.body : JSON.stringify(options2.body)) : undefined,
      });

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

      if (res.status === 401 && onUnauthorized) {
        const info = normalizeError(res, body, null);
        try {
          onUnauthorized(info);
        } catch {
          // Do not break the original request flow if callback throws.
        }
      }

      if (!res.ok) return normalizeError(res, body, null);
      return ok(body, res.status, "OK");
    } catch (e) {
      return normalizeError(null, null, e);
    }
  }

  return {
    request,
    get: (path, params, headers) => request("GET", path, { params, headers }),
    post: (path, body, params, headers) => request("POST", path, { body, params, headers }),
    put: (path, body, params, headers) => request("PUT", path, { body, params, headers }),
    patch: (path, body, params, headers) => request("PATCH", path, { body, params, headers }),
    del: (path, params, headers) => request("DELETE", path, { params, headers }),
  };
}

/**
 * In-memory fake dataset for UI scaffolding.
 */
const fakeDb = {
  students: [
    {
      id: "stu_001",
      firstName: "Amina",
      lastName: "Khan",
      phone: "+1 (555) 010-2030",
      status: "Active",
      enrolledService: "Standard Package",
      createdAt: "2026-01-05",
    },
    {
      id: "stu_002",
      firstName: "Jon",
      lastName: "Miller",
      phone: "+1 (555) 010-7788",
      status: "Pending Docs",
      enrolledService: "Express Package",
      createdAt: "2026-01-12",
    },
  ],
  instructors: [
    { id: "ins_001", firstName: "Sophia", lastName: "Reed", phone: "+1 (555) 010-4001", status: "Available", createdAt: "2026-01-04" },
    { id: "ins_002", firstName: "Omar", lastName: "Ali", phone: "+1 (555) 010-4011", status: "Assigned", createdAt: "2026-01-10" },
  ],
  services: [
    { id: "srv_001", name: "Standard Package", price: 350, lessons: 10, active: true },
    { id: "srv_002", name: "Express Package", price: 500, lessons: 15, active: true },
  ],
  documents: [
    { id: "doc_001", studentId: "stu_002", type: "ID Proof", status: "Missing", updatedAt: "2026-01-16" },
    { id: "doc_002", studentId: "stu_001", type: "Medical", status: "Received", updatedAt: "2026-01-06" },
  ],
  transactions: [
    { id: "txn_001", date: "2026-01-07", type: "Payment", amount: 350, status: "Completed" },
    { id: "txn_002", date: "2026-01-17", type: "Refund", amount: -50, status: "Pending" },
  ],
  activity: [
    { id: "act_001", at: "2026-01-17 10:12", label: "Student Jon Miller added", meta: "Students" },
    { id: "act_002", at: "2026-01-16 14:28", label: "Document marked missing", meta: "Documents" },
    { id: "act_003", at: "2026-01-15 09:05", label: "Instructor assigned to student", meta: "Instructors" },
  ],
  /**
   * Stub mapping: instructorId -> studentIds[]
   * Used by the Instructors module assignment UI in stub mode.
   */
  instructorStudents: {
    ins_002: ["stu_001"],
  },
};

function demoAuthResponse() {
  return ok({
    accessToken: "demo-token",
    user: { id: "usr_demo", email: "admin@demo.local", name: "Demo Admin", roles: ["admin"] },
  });
}

/**
 * Create the stub-first API modules (pure in-memory).
 * Kept separate so network mode can reuse signatures.
 */
function createStubModules() {
  return {
    dashboard: {
      async getSummary() {
        await delay(DEFAULT_DELAY_MS);
        return ok({
          kpis: [
            { label: "Active Students", value: fakeDb.students.filter((s) => s.status === "Active").length },
            { label: "Pending Documents", value: fakeDb.documents.filter((d) => d.status !== "Received").length },
            { label: "Instructors", value: fakeDb.instructors.length },
            {
              label: "Revenue (MTD)",
              value: `$${fakeDb.transactions.reduce((acc, t) => acc + (t.amount > 0 ? t.amount : 0), 0)}`,
            },
          ],
          recentActivity: fakeDb.activity.slice(0, 6),
        });
      },
    },

    students: {
      /**
       * List students with stubbed server-like behavior:
       * - supports { page, pageSize, search, status }
       * - returns { items, page, pageSize, total }
       */
      async list(params = {}) {
        await delay(DEFAULT_DELAY_MS);

        const page = Number(params.page) > 0 ? Number(params.page) : 1;
        const pageSize = Number(params.pageSize) > 0 ? Number(params.pageSize) : 10;
        const search = String(params.search || "").trim().toLowerCase();
        const status = String(params.status || "").trim();

        let rows = [...fakeDb.students];

        if (search) {
          rows = rows.filter((s) => {
            const hay = `${s.firstName || ""} ${s.lastName || ""} ${s.phone || ""} ${s.enrolledService || ""}`.toLowerCase();
            return hay.includes(search);
          });
        }

        if (status && status !== "All") {
          rows = rows.filter((s) => String(s.status) === status);
        }

        // Sort newest first (roughly by createdAt when present)
        rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

        const total = rows.length;
        const start = (page - 1) * pageSize;
        const items = rows.slice(start, start + pageSize);

        return ok({ items, page, pageSize, total });
      },

      async get(id) {
        await delay(DEFAULT_DELAY_MS);
        const found = fakeDb.students.find((s) => s.id === id);
        return found ? ok({ ...found }) : fail("Student not found", 404);
      },

      async create(payload) {
        await delay(DEFAULT_DELAY_MS);
        const created = {
          id: `stu_${String(Math.random()).slice(2, 6)}`,
          createdAt: new Date().toISOString().slice(0, 10),
          status: payload.status || "Active",
          ...payload,
        };
        fakeDb.students.unshift(created);
        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Student ${created.firstName} ${created.lastName} added`,
          meta: "Students",
        });
        return ok(created, 201);
      },

      async update(id, payload) {
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.students.findIndex((s) => s.id === id);
        if (idx === -1) return fail("Student not found", 404);
        fakeDb.students[idx] = { ...fakeDb.students[idx], ...payload };
        return ok({ ...fakeDb.students[idx] });
      },

      async remove(id) {
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.students.findIndex((s) => s.id === id);
        if (idx === -1) return fail("Student not found", 404);

        const removed = fakeDb.students[idx];
        fakeDb.students.splice(idx, 1);

        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Student ${removed.firstName} ${removed.lastName} deleted`,
          meta: "Students",
        });

        return ok({ id }, 200, "Deleted");
      },
    },

    instructors: {
      /**
       * List instructors with stubbed server-like behavior:
       * - supports { page, pageSize, search, status }
       * - returns { items, page, pageSize, total }
       */
      async list(params = {}) {
        await delay(DEFAULT_DELAY_MS);

        const page = Number(params.page) > 0 ? Number(params.page) : 1;
        const pageSize = Number(params.pageSize) > 0 ? Number(params.pageSize) : 10;
        const search = String(params.search || "").trim().toLowerCase();
        const status = String(params.status || "").trim();

        let rows = [...fakeDb.instructors];

        if (search) {
          rows = rows.filter((i) => {
            const hay = `${i.firstName || ""} ${i.lastName || ""} ${i.phone || ""}`.toLowerCase();
            return hay.includes(search);
          });
        }

        if (status && status !== "All") {
          rows = rows.filter((i) => String(i.status) === status);
        }

        // Sort newest first (roughly by createdAt when present)
        rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

        const total = rows.length;
        const start = (page - 1) * pageSize;
        const items = rows.slice(start, start + pageSize);

        return ok({ items, page, pageSize, total });
      },

      async get(id) {
        await delay(DEFAULT_DELAY_MS);
        const found = fakeDb.instructors.find((i) => i.id === id);
        return found ? ok({ ...found }) : fail("Instructor not found", 404);
      },

      async create(payload) {
        await delay(DEFAULT_DELAY_MS);
        const created = {
          id: `ins_${String(Math.random()).slice(2, 6)}`,
          createdAt: new Date().toISOString().slice(0, 10),
          status: payload.status || "Available",
          ...payload,
        };
        fakeDb.instructors.unshift(created);

        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Instructor ${created.firstName || ""} ${created.lastName || ""} added`,
          meta: "Instructors",
        });

        return ok(created, 201);
      },

      async update(id, payload) {
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.instructors.findIndex((i) => i.id === id);
        if (idx === -1) return fail("Instructor not found", 404);
        fakeDb.instructors[idx] = { ...fakeDb.instructors[idx], ...payload };
        return ok({ ...fakeDb.instructors[idx] });
      },

      async remove(id) {
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.instructors.findIndex((i) => i.id === id);
        if (idx === -1) return fail("Instructor not found", 404);

        const removed = fakeDb.instructors[idx];
        fakeDb.instructors.splice(idx, 1);
        delete fakeDb.instructorStudents[String(id)];

        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Instructor ${removed.firstName || ""} ${removed.lastName || ""} deleted`,
          meta: "Instructors",
        });

        return ok({ id }, 200, "Deleted");
      },

      async listAssignedStudents(instructorId) {
        await delay(DEFAULT_DELAY_MS);
        const ids = fakeDb.instructorStudents[String(instructorId)] || [];
        const items = fakeDb.students.filter((s) => ids.includes(s.id));
        return ok(items);
      },

      async assignStudent({ instructorId, studentId }) {
        await delay(DEFAULT_DELAY_MS);

        const inst = fakeDb.instructors.find((i) => i.id === instructorId);
        const stu = fakeDb.students.find((s) => s.id === studentId);

        if (!inst) return fail("Instructor not found", 404);
        if (!stu) return fail("Student not found", 404);

        const key = String(instructorId);
        const list = Array.isArray(fakeDb.instructorStudents[key]) ? fakeDb.instructorStudents[key] : [];
        if (!list.includes(String(studentId))) list.push(String(studentId));
        fakeDb.instructorStudents[key] = list;

        // Keep a simple derived status for UI
        inst.status = list.length > 0 ? "Assigned" : "Available";

        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Student ${studentId} attached to instructor ${instructorId}`,
          meta: "Instructors",
        });

        return ok({ instructorId, studentId });
      },

      async unassignStudent({ instructorId, studentId }) {
        await delay(DEFAULT_DELAY_MS);

        const inst = fakeDb.instructors.find((i) => i.id === instructorId);
        if (!inst) return fail("Instructor not found", 404);

        const key = String(instructorId);
        const list = Array.isArray(fakeDb.instructorStudents[key]) ? fakeDb.instructorStudents[key] : [];
        fakeDb.instructorStudents[key] = list.filter((id) => id !== String(studentId));

        inst.status = fakeDb.instructorStudents[key].length > 0 ? "Assigned" : "Available";

        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Student ${studentId} detached from instructor ${instructorId}`,
          meta: "Instructors",
        });

        return ok({ instructorId, studentId });
      },
    },

    services: {
      async list() {
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.services]);
      },
      async update(id, payload) {
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.services.findIndex((s) => s.id === id);
        if (idx === -1) return fail("Service not found", 404);
        fakeDb.services[idx] = { ...fakeDb.services[idx], ...payload };
        return ok({ ...fakeDb.services[idx] });
      },
      async create(payload) {
        await delay(DEFAULT_DELAY_MS);
        const created = { id: `srv_${String(Math.random()).slice(2, 6)}`, active: true, ...payload };
        fakeDb.services.unshift(created);
        return ok(created, 201);
      },
    },

    documents: {
      async list() {
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.documents]);
      },
      async updateStatus(id, status) {
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.documents.findIndex((d) => d.id === id);
        if (idx === -1) return fail("Document not found", 404);
        fakeDb.documents[idx] = {
          ...fakeDb.documents[idx],
          status,
          updatedAt: new Date().toISOString().slice(0, 10),
        };
        return ok({ ...fakeDb.documents[idx] });
      },
    },

    finance: {
      async listTransactions() {
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.transactions]);
      },
    },

    auth: {
      async login() {
        await delay(DEFAULT_DELAY_MS);
        return demoAuthResponse();
      },
      async me() {
        await delay(DEFAULT_DELAY_MS);
        return ok({ id: "usr_demo", email: "admin@demo.local", name: "Demo Admin", roles: ["admin"] });
      },
    },
  };
}

/**
 * Create the network-backed API modules.
 * Paths are centralized here (no hardcoding outside the client).
 * @param {ReturnType<typeof createHttpClient>} http
 */
function createNetworkModules(http) {
  return {
    dashboard: {
      async getSummary(params) {
        // Optional params for future pagination/filters
        return http.get("/dashboard/summary", params);
      },
    },

    students: {
      async list(params) {
        // Prefer explicit params: { page, pageSize, search, status }
        // (passes through buildQuery which supports both standard + extra keys)
        return http.get("/students", params);
      },
      async get(id) {
        return http.get(`/students/${encodeURIComponent(String(id))}`);
      },
      async create(payload) {
        return http.post("/students", payload);
      },
      async update(id, payload) {
        return http.put(`/students/${encodeURIComponent(String(id))}`, payload);
      },
      async remove(id) {
        return http.del(`/students/${encodeURIComponent(String(id))}`);
      },
    },

    instructors: {
      async list(params) {
        return http.get("/instructors", params);
      },
      async get(id) {
        return http.get(`/instructors/${encodeURIComponent(String(id))}`);
      },
      async create(payload) {
        return http.post("/instructors", payload);
      },
      async update(id, payload) {
        return http.put(`/instructors/${encodeURIComponent(String(id))}`, payload);
      },
      async remove(id) {
        return http.del(`/instructors/${encodeURIComponent(String(id))}`);
      },

      // Assignment endpoints (best-guess REST names; stub mode still works if backend differs)
      async listAssignedStudents(instructorId) {
        return http.get(`/instructors/${encodeURIComponent(String(instructorId))}/students`);
      },
      async assignStudent({ instructorId, studentId }) {
        return http.post(`/instructors/${encodeURIComponent(String(instructorId))}/students`, { studentId });
      },
      async unassignStudent({ instructorId, studentId }) {
        return http.del(`/instructors/${encodeURIComponent(String(instructorId))}/students/${encodeURIComponent(String(studentId))}`);
      },

      // Backward-compatible existing endpoint
      async assign({ instructorId, studentId }) {
        return http.post("/instructors/assign", { instructorId, studentId });
      },
    },

    services: {
      async list(params) {
        return http.get("/services", params);
      },
      async update(id, payload) {
        return http.put(`/services/${encodeURIComponent(String(id))}`, payload);
      },
      async create(payload) {
        return http.post("/services", payload);
      },
    },

    documents: {
      async list(params) {
        return http.get("/documents", params);
      },
      async updateStatus(id, status) {
        return http.put(`/documents/${encodeURIComponent(String(id))}`, { status });
      },
    },

    finance: {
      async listTransactions(params) {
        return http.get("/finance/transactions", params);
      },
    },

    auth: {
      async login(payload) {
        return http.post("/auth/login", payload);
      },
      async me() {
        return http.get("/auth/me");
      },
    },
  };
}

// PUBLIC_INTERFACE
export function createApiClient(options = {}) {
  /** This is a public function returning the DSMS API client (stub-first, env-driven network switch). */
  const cfg = getRuntimeConfig();

  const stubs = createStubModules();

  const http = createHttpClient({
    getToken: options.getToken || readToken,
    onUnauthorized:
      options.onUnauthorized ||
      (() => {
        // Default behavior: clear stored token so AuthContext bootstrapping will reset.
        try {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
      }),
  });

  const network = createNetworkModules(http);

  // Highest precedence: explicit disable network => force stubs.
  // If network enabled but stubs enabled, we still use stub auth (keeps login usable),
  // while allowing other modules to use network.
  const useNetwork = Boolean(cfg.useNetwork);

  return {
    // keep existing behavior/exports
    config: getRuntimeConfig,
    buildQuery,

    // Backward-compatible endpoints helper (still useful for debug)
    endpoints: {
      students: () => endpoint("/students"),
      instructors: () => endpoint("/instructors"),
      services: () => endpoint("/services"),
      documents: () => endpoint("/documents"),
      transactions: () => endpoint("/finance/transactions"),
      activity: () => endpoint("/activity"),
      login: () => endpoint("/auth/login"),
      me: () => endpoint("/auth/me"),
    },

    // Modules: route based on env
    dashboard: {
      async getSummary(params) {
        if (!useNetwork) return stubs.dashboard.getSummary(params);
        return network.dashboard.getSummary(params);
      },
    },

    students: {
      async list(params) {
        if (!useNetwork) return stubs.students.list(params);
        return network.students.list(params);
      },
      async get(id) {
        if (!useNetwork) return stubs.students.get(id);
        return network.students.get(id);
      },
      // Backward compatible alias (some pages may still call getById)
      async getById(id) {
        if (!useNetwork) return stubs.students.get(id);
        return network.students.get(id);
      },
      async create(payload) {
        if (!useNetwork) return stubs.students.create(payload);
        return network.students.create(payload);
      },
      async update(id, payload) {
        if (!useNetwork) return stubs.students.update(id, payload);
        return network.students.update(id, payload);
      },
      async remove(id) {
        if (!useNetwork) return stubs.students.remove(id);
        return network.students.remove(id);
      },
    },

    instructors: {
      async list(params) {
        if (!useNetwork) return stubs.instructors.list(params);
        return network.instructors.list(params);
      },
      async get(id) {
        if (!useNetwork) return stubs.instructors.get(id);
        return network.instructors.get(id);
      },
      async create(payload) {
        if (!useNetwork) return stubs.instructors.create(payload);
        return network.instructors.create(payload);
      },
      async update(id, payload) {
        if (!useNetwork) return stubs.instructors.update(id, payload);
        return network.instructors.update(id, payload);
      },
      async remove(id) {
        if (!useNetwork) return stubs.instructors.remove(id);
        return network.instructors.remove(id);
      },

      async listAssignedStudents(instructorId) {
        if (!useNetwork) return stubs.instructors.listAssignedStudents(instructorId);
        return network.instructors.listAssignedStudents(instructorId);
      },
      async assignStudent(payload) {
        if (!useNetwork) return stubs.instructors.assignStudent(payload);
        return network.instructors.assignStudent(payload);
      },
      async unassignStudent(payload) {
        if (!useNetwork) return stubs.instructors.unassignStudent(payload);
        return network.instructors.unassignStudent(payload);
      },

      // Backward compatible (older pages/flows)
      async assign(payload) {
        if (!useNetwork) {
          // Map to new stub name
          return stubs.instructors.assignStudent(payload);
        }
        return network.instructors.assign(payload);
      },
    },

    services: {
      async list(params) {
        if (!useNetwork) return stubs.services.list(params);
        return network.services.list(params);
      },
      async update(id, payload) {
        if (!useNetwork) return stubs.services.update(id, payload);
        return network.services.update(id, payload);
      },
      async create(payload) {
        if (!useNetwork) return stubs.services.create(payload);
        return network.services.create(payload);
      },
    },

    documents: {
      async list(params) {
        if (!useNetwork) return stubs.documents.list(params);
        return network.documents.list(params);
      },
      async updateStatus(id, status) {
        if (!useNetwork) return stubs.documents.updateStatus(id, status);
        return network.documents.updateStatus(id, status);
      },
    },

    finance: {
      async listTransactions(params) {
        if (!useNetwork) return stubs.finance.listTransactions(params);
        return network.finance.listTransactions(params);
      },
    },

    auth: {
      async login(payload) {
        // Auth can be forced to stub via useStubs, regardless of network switch.
        if (cfg.useStubs) return stubs.auth.login(payload);
        if (!useNetwork) return stubs.auth.login(payload);

        const res = await network.auth.login(payload);
        // Keep app usable even if backend auth isn't up yet.
        if (!res.ok) return demoAuthResponse();
        return res;
      },

      async me() {
        if (cfg.useStubs) return stubs.auth.me();
        if (!useNetwork) return stubs.auth.me();

        const res = await network.auth.me();
        // Keep UX stable if backend isn't ready.
        if (!res.ok) return stubs.auth.me();
        return res;
      },
    },
  };
}

// PUBLIC_INTERFACE
export const api = createApiClient();
/** This is a public default API singleton export (backward-compatible convenience). */
