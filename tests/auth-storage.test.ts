import { describe, expect, it } from "vitest";
import { createAuthStorage, isAccountSession, type KeyValueStore } from "../src/net/authStorage";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const KEY = "sb-test-auth-token";
const guest = JSON.stringify({ access_token: "g", user: { id: "g", is_anonymous: true } });
const account = JSON.stringify({ access_token: "a", user: { id: "a", is_anonymous: false } });

describe("isAccountSession", () => {
  it("recognises a signed-in account", () => {
    expect(isAccountSession(account)).toBe(true);
  });

  it("treats a guest, a verifier and garbage as the tab's own", () => {
    expect(isAccountSession(guest)).toBe(false);
    expect(isAccountSession("pkce-verifier-string")).toBe(false);
    expect(isAccountSession("null")).toBe(false);
  });
});

describe("createAuthStorage", () => {
  it("keeps a guest in the tab", () => {
    const tab = memory();
    const browser = memory();
    createAuthStorage(tab, browser).setItem(KEY, guest);
    expect(tab.data.get(KEY)).toBe(guest);
    expect(browser.data.has(KEY)).toBe(false);
  });

  it("moves an account to the browser and drops the guest it replaces", () => {
    const tab = memory();
    const browser = memory();
    const store = createAuthStorage(tab, browser);
    store.setItem(KEY, guest);
    store.setItem(KEY, account);
    expect(browser.data.get(KEY)).toBe(account);
    expect(tab.data.has(KEY)).toBe(false);
    expect(store.getItem(KEY)).toBe(account);
  });

  it("gives a fresh tab the account", () => {
    const browser = memory();
    browser.setItem(KEY, account);
    expect(createAuthStorage(memory(), browser).getItem(KEY)).toBe(account);
  });

  it("never swaps a seated guest for an account signed in elsewhere", () => {
    const tab = memory();
    const browser = memory();
    tab.setItem(KEY, guest);
    browser.setItem(KEY, account);
    expect(createAuthStorage(tab, browser).getItem(KEY)).toBe(guest);
  });

  it("lets a lapsed guest go without signing the account out", () => {
    const tab = memory();
    const browser = memory();
    tab.setItem(KEY, guest);
    browser.setItem(KEY, account);
    createAuthStorage(tab, browser).removeItem(KEY);
    expect(tab.data.has(KEY)).toBe(false);
    expect(browser.data.get(KEY)).toBe(account);
  });

  it("keeps a second account in its own tab rather than taking over the first", () => {
    const tab = memory();
    const browser = memory();
    browser.setItem(KEY, account);
    const other = JSON.stringify({ access_token: "b", user: { id: "b", is_anonymous: false } });
    const store = createAuthStorage(tab, browser);
    store.setItem(KEY, other);
    expect(browser.data.get(KEY)).toBe(account);
    expect(store.getItem(KEY)).toBe(other);
  });

  it("signs the account out when it is the one being removed", () => {
    const browser = memory();
    browser.setItem(KEY, account);
    createAuthStorage(memory(), browser).removeItem(KEY);
    expect(browser.data.has(KEY)).toBe(false);
  });
});
