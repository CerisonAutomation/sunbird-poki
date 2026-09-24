// Node >= 22 exposes an experimental `localStorage` global that is inert without
// --localstorage-file, which prevents jsdom from installing its own storage.
// Provide a working fallback backed by `Storage.prototype` so tests that spy on
// `Storage.prototype.setItem` (e.g. quota-exceeded simulations) still intercept.
const g = globalThis as unknown as Record<string, unknown>;

function usable(s: unknown): s is Storage {
  if (!s || typeof (s as Storage).clear !== "function") return false;
  try {
    (s as Storage).setItem("__probe__", "1");
    (s as Storage).removeItem("__probe__");
    return true;
  } catch {
    return false;
  }
}

function install(name: "localStorage" | "sessionStorage"): void {
  const DATA = Symbol(name);
  const Ctor = typeof Storage === "function" ? Storage : function Storage(this: object) {} as unknown as typeof Storage;
  const proto = Ctor.prototype as unknown as Record<string | symbol, unknown>;
  const data = (s: object): Map<string, string> => {
    if (!(DATA in s)) Object.defineProperty(s, DATA, { value: new Map<string, string>(), configurable: true });
    return (s as Record<symbol, Map<string, string>>)[DATA];
  };
  proto.getItem = function (k: string) {
    const m = data(this);
    return m.has(String(k)) ? m.get(String(k))! : null;
  };
  proto.setItem = function (k: string, v: string) {
    data(this).set(String(k), String(v));
  };
  proto.removeItem = function (k: string) {
    data(this).delete(String(k));
  };
  proto.clear = function () {
    data(this).clear();
  };
  proto.key = function (i: number) {
    return [...data(this).keys()][i] ?? null;
  };
  const inst = Object.create(proto);
  // `length` is a non-configurable getter on the native Storage prototype;
  // redefine it on the instance instead of the prototype to avoid
  // "Cannot redefine property: length" on newer Node.js builds.
  Object.defineProperty(inst, "length", { get(this: object) { return data(this as object).size; }, configurable: true });
  g[name] = inst;
  try {
    (window as unknown as Record<string, unknown>)[name] = inst;
  } catch {
    // window accessor not writable in this environment — globalThis fallback is enough.
  }
}

if (!usable(g.localStorage)) install("localStorage");
if (!usable(g.sessionStorage)) install("sessionStorage");
