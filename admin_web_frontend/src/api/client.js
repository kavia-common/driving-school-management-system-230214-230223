import { getRuntimeConfig } from "../config/env";

/**
 * Minimal API client wrapper.
 * This client is intentionally stub-first: it provides predictable fake data by default
 * and can be switched to real HTTP by setting `useNetwork` to true later.
 */

/**
 * @typedef {Object} ApiResult
 * @property {boolean} ok
 * @property {any} data
 * @property {string=} error
 */

const DEFAULT_DELAY_MS = 250;

/**
 * Simulate network latency.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {any} data
 * @returns {ApiResult}
 */
function ok(data) {
  return { ok: true, data };
}

/**
 * @param {string} error
 * @returns {ApiResult}
 */
function fail(error) {
  return { ok: false, data: null, error };
}

/**
 * Centralized endpoint builder.
 * @param {string} path
 */
function endpoint(path) {
  const { apiBase } = getRuntimeConfig();
  return `${String(apiBase).replace(/\/$/, "")}${path}`;
}

/**
 * Token-aware network request helper.
 * @param {string} method
 * @param {string} path
 * @param {any=} body
 * @param {string=} token
 * @returns {Promise<ApiResult>}
 */
async function request(method, path, body, token) {
  try {
    const url = endpoint(path);
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });

    if (!res.ok) return fail(`Request failed (${res.status})`);
    const json = await res.json().catch(() => null);
    return ok(json);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unknown error");
  }
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
    { id: "ins_001", name: "Sophia Reed", phone: "+1 (555) 010-4001", status: "Available" },
    { id: "ins_002", name: "Omar Ali", phone: "+1 (555) 010-4011", status: "Assigned" },
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
};

/**
 * Stub toggles: keep false for now to avoid assuming a backend exists.
 * Auth is special: it will attempt network login when `useNetwork` is true, but can fall back to stubs.
 */
const useNetwork = false;

function demoAuth() {
  return ok({
    accessToken: "demo-token",
    user: { id: "usr_demo", email: "admin@demo.local", name: "Demo Admin", roles: ["admin"] },
  });
}

// PUBLIC_INTERFACE
export function createApiClient() {
  /** This is a public function returning the DSMS API client (stub-first). */
  return {
    config: getRuntimeConfig,
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

    auth: {
      /**
       * Login with email/password.
       * In stub mode, always succeeds with a demo admin user.
       * In network mode, attempts POST /auth/login and falls back to demo user if backend is unavailable.
       * @param {{email: string, password: string}} payload
       * @returns {Promise<ApiResult>}
       */
      async login(payload) {
        const { useStubs } = getRuntimeConfig();
        if (useStubs) {
          await delay(DEFAULT_DELAY_MS);
          return demoAuth();
        }

        if (useNetwork) {
          const res = await request("POST", "/auth/login", payload);
          if (res.ok) return res;
          // Keep the UI usable if auth endpoint isn't up yet.
          return demoAuth();
        }

        await delay(DEFAULT_DELAY_MS);
        return demoAuth();
      },

      /**
       * Fetch current user profile for an existing session.
       * In stub mode returns demo profile.
       * In network mode calls GET /auth/me and falls back to demo profile if backend is unavailable.
       * @param {string} token
       * @returns {Promise<ApiResult>}
       */
      async me(token) {
        const { useStubs } = getRuntimeConfig();
        if (useStubs) {
          await delay(DEFAULT_DELAY_MS);
          return ok({ id: "usr_demo", email: "admin@demo.local", name: "Demo Admin", roles: ["admin"] });
        }

        if (useNetwork) {
          const res = await request("GET", "/auth/me", undefined, token);
          if (res.ok) return res;
          return ok({ id: "usr_demo", email: "admin@demo.local", name: "Demo Admin", roles: ["admin"] });
        }

        await delay(DEFAULT_DELAY_MS);
        return ok({ id: "usr_demo", email: "admin@demo.local", name: "Demo Admin", roles: ["admin"] });
      },
    },

    dashboard: {
      async getSummary() {
        if (useNetwork) return request("GET", "/dashboard/summary");
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
      async list() {
        if (useNetwork) return request("GET", "/students");
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.students]);
      },
      async getById(id) {
        if (useNetwork) return request("GET", `/students/${id}`);
        await delay(DEFAULT_DELAY_MS);
        const found = fakeDb.students.find((s) => s.id === id);
        return found ? ok({ ...found }) : fail("Student not found");
      },
      async create(payload) {
        if (useNetwork) return request("POST", "/students", payload);
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
        return ok(created);
      },
      async update(id, payload) {
        if (useNetwork) return request("PUT", `/students/${id}`, payload);
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.students.findIndex((s) => s.id === id);
        if (idx === -1) return fail("Student not found");
        fakeDb.students[idx] = { ...fakeDb.students[idx], ...payload };
        return ok({ ...fakeDb.students[idx] });
      },
    },

    instructors: {
      async list() {
        if (useNetwork) return request("GET", "/instructors");
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.instructors]);
      },
      async assign({ instructorId, studentId }) {
        if (useNetwork) return request("POST", "/instructors/assign", { instructorId, studentId });
        await delay(DEFAULT_DELAY_MS);
        const inst = fakeDb.instructors.find((i) => i.id === instructorId);
        if (!inst) return fail("Instructor not found");
        inst.status = "Assigned";
        fakeDb.activity.unshift({
          id: `act_${String(Math.random()).slice(2, 6)}`,
          at: new Date().toISOString().replace("T", " ").slice(0, 16),
          label: `Instructor assigned to student ${studentId}`,
          meta: "Instructors",
        });
        return ok({ instructorId, studentId });
      },
    },

    services: {
      async list() {
        if (useNetwork) return request("GET", "/services");
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.services]);
      },
      async update(id, payload) {
        if (useNetwork) return request("PUT", `/services/${id}`, payload);
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.services.findIndex((s) => s.id === id);
        if (idx === -1) return fail("Service not found");
        fakeDb.services[idx] = { ...fakeDb.services[idx], ...payload };
        return ok({ ...fakeDb.services[idx] });
      },
      async create(payload) {
        if (useNetwork) return request("POST", "/services", payload);
        await delay(DEFAULT_DELAY_MS);
        const created = { id: `srv_${String(Math.random()).slice(2, 6)}`, active: true, ...payload };
        fakeDb.services.unshift(created);
        return ok(created);
      },
    },

    documents: {
      async list() {
        if (useNetwork) return request("GET", "/documents");
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.documents]);
      },
      async updateStatus(id, status) {
        if (useNetwork) return request("PUT", `/documents/${id}`, { status });
        await delay(DEFAULT_DELAY_MS);
        const idx = fakeDb.documents.findIndex((d) => d.id === id);
        if (idx === -1) return fail("Document not found");
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
        if (useNetwork) return request("GET", "/finance/transactions");
        await delay(DEFAULT_DELAY_MS);
        return ok([...fakeDb.transactions]);
      },
    },
  };
}
