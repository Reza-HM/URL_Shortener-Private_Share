import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function createdUrl(page: Page) {
  await expect(page.getByLabel("Share link", { exact: true })).toBeVisible();
  return page.getByLabel("Share link", { exact: true }).inputValue();
}
async function captureUploads(page: Page) {
  await page.addInitScript(() => {
    const original = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      if (body instanceof FormData) {
        (window as unknown as { relayUpload: Promise<string> }).relayUpload =
          Promise.all(
            [...body.entries()].map(
              async ([name, value]) =>
                `${name}:${typeof value === "string" ? value : `${value.name}:${await value.text()}`}`,
            ),
          ).then((parts) => parts.join("\n"));
      }
      original.call(this, body);
    };
  });
}
async function makeText(
  page: Page,
  text: string,
  options: {
    password?: string;
    oneTime?: boolean;
    remember?: boolean;
    code?: boolean;
  } = {},
) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Private Drop" }).click();
  if (options.code)
    await page.getByRole("button", { name: "Code", exact: true }).click();
  await page
    .getByLabel(options.code ? "Your code" : "Your text", { exact: true })
    .fill(text);
  if (options.password || options.oneTime) {
    await page.getByText("Set the ground rules").click();
    if (options.password) {
      await page.getByRole("switch", { name: /Password protection/ }).check();
      await page
        .getByLabel("Drop password", { exact: true })
        .fill(options.password);
    }
    if (options.oneTime)
      await page.getByRole("switch", { name: /One-time reveal/ }).check();
  }
  if (options.remember)
    await page
      .getByRole("checkbox", { name: /Remember on this device/ })
      .check();
  await page.getByRole("button", { name: "Create private drop" }).click();
  return createdUrl(page);
}

test("short link creation, preview, QR, management and disable", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByLabel(/Destination URL/)
    .fill("https://example.com/path?hello=world#section");
  await page.getByText("Make it yours").click();
  const alias = `browser-${Date.now()}`;
  await page.getByLabel("Custom alias").fill(alias);
  await page.getByRole("button", { name: "Shorten link", exact: true }).click();
  const url = await createdUrl(page);
  expect(url).toContain(`/s/${alias}`);
  await page.getByRole("button", { name: "QR code", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "QR code for this share" }),
  ).toBeVisible();
  const qrDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download QR code" }).click();
  expect((await qrDownload).suggestedFilename()).toBe("relay-share.png");
  await page.getByRole("button", { name: "Close QR code" }).click();
  const redirect = await request.get(url, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe(
    "https://example.com/path?hello=world#section",
  );
  await page.getByRole("link", { name: "Manage share", exact: true }).click();
  await expect(
    page.getByText("Your short link", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Preview destination" }).click();
  await expect(page).toHaveURL(new RegExp(`/preview/${alias}$`));
  await expect(
    page.getByText("https://example.com/path?hello=world#section", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/manage\/.+#token=/);
  await page.getByRole("button", { name: "Disable link", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Disable link", exact: true })
    .click();
  await expect(page.getByText("disabled", { exact: true })).toBeVisible();
  const disabled = await request.get(url, { maxRedirects: 0 });
  expect(disabled.status()).toBe(302);
  expect(disabled.headers().location).toContain("/unavailable");
});

test("cross-context encrypted Unicode text with password and one-time reveal", async ({
  page,
  browser,
}) => {
  const text = "سلام 🌱 — browser-only private note 23819";
  const seenRequests: { url: string; body: string }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/"))
      seenRequests.push({
        url: request.url(),
        body: request.postDataBuffer()?.toString("utf8") || "",
      });
  });
  const url = await makeText(page, text, {
    password: "a-private-password",
    oneTime: true,
  });
  const key = new URLSearchParams(new URL(url).hash.slice(1)).get("key")!;
  expect(
    seenRequests.every(
      (request) =>
        !request.url.includes(key) &&
        !request.body.includes(key) &&
        !request.body.includes(text),
    ),
  ).toBe(true);
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(url);
  await expect(
    recipient.getByRole("button", { name: "Reveal content" }),
  ).toBeVisible();
  await recipient
    .getByLabel("Password", { exact: true })
    .fill("incorrect-password");
  await recipient.getByRole("button", { name: "Reveal content" }).click();
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "incorrect",
  );
  await recipient
    .getByLabel("Password", { exact: true })
    .fill("a-private-password");
  await recipient.getByRole("button", { name: "Reveal content" }).click();
  await expect(recipient.locator(".drop-text")).toHaveText(text);
  await expect(
    recipient.getByText(/This drop has been consumed/),
  ).toBeVisible();
  await recipient.reload();
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "already been opened",
  );
  await context.close();
});

test("code highlighting escapes HTML and clipboard fallback selects plaintext", async ({
  page,
  browser,
}) => {
  const text =
    'const greeting = "<img src=x onerror=alert(1)>";\nconsole.log(greeting);';
  const url = await makeText(page, text, { code: true });
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await recipient.goto(url);
  await recipient.getByRole("button", { name: "Reveal content" }).click();
  await expect(recipient.getByLabel("Shared code")).toHaveText(text);
  await expect(recipient.locator(".code-view img")).toHaveCount(0);
  await expect(recipient.locator(".code-view .hljs-keyword")).not.toHaveCount(
    0,
  );
  await recipient
    .getByRole("button", { name: "Copy content", exact: true })
    .click();
  await expect(
    recipient.getByRole("textbox", { name: /Copy manually/ }),
  ).toHaveValue(text);
  await context.close();
});

test("encrypted file round trip preserves bytes and hides the filename in upload", async ({
  page,
  browser,
}) => {
  await captureUploads(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Private Drop" }).click();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const filename = "private-budget-23819.txt",
    bytes = Buffer.from("private file bytes: سلام\n", "utf8");
  await page
    .getByLabel("Choose a file", { exact: true })
    .setInputFiles({ name: filename, mimeType: "text/plain", buffer: bytes });
  await page.getByRole("button", { name: "Create private drop" }).click();
  const url = await createdUrl(page);
  const body = await page.evaluate(
    () => (window as unknown as { relayUpload: Promise<string> }).relayUpload,
  );
  expect(body).not.toContain(filename);
  expect(body).not.toContain("private file bytes");
  const context = await browser.newContext({ acceptDownloads: true }),
    recipient = await context.newPage();
  await recipient.goto(url);
  const downloaded = recipient.waitForEvent("download");
  await recipient.getByRole("button", { name: "Reveal & download" }).click();
  const result = await downloaded;
  expect(result.suggestedFilename()).toBe(filename);
  expect(await readFile((await result.path())!)).toEqual(bytes);
  await context.close();
});

test("history is opt-in, persists in this browser and can be forgotten", async ({
  page,
}) => {
  await makeText(page, "not remembered");
  await page.getByRole("link", { name: "My shares", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start." }),
  ).toBeVisible();
  await makeText(page, "clear-history-only", { remember: true });
  await page.getByRole("link", { name: "My shares", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep it", exact: true })
    .click();
  await expect(page.getByText("Text drop", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A fresh start." }),
  ).toBeVisible();
  const url = await makeText(page, "remembered", { remember: true });
  await page.getByRole("link", { name: "My shares", exact: true }).click();
  await expect(page.getByText("Text drop", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Open", exact: true }),
  ).toHaveAttribute("href", url);
  await page.getByRole("button", { name: "Forget", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start." }),
  ).toBeVisible();
});

test("management rejects incomplete capabilities and deletion blocks recipients", async ({
  page,
  browser,
}) => {
  const url = await makeText(page, "delete this private drop");
  const manage = await page
    .getByRole("link", { name: "Manage share", exact: true })
    .getAttribute("href");
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(manage!.split("#")[0]);
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "incomplete",
  );
  await page.goto(manage!);
  await page.getByRole("button", { name: "Delete share", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete share", exact: true })
    .click();
  await expect(page.getByText("deleted", { exact: true })).toBeVisible();
  await recipient.goto(url);
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "expired, been deleted",
  );
  await context.close();
});

test("missing and wrong keys have explicit errors without accidental reveal", async ({
  page,
  browser,
}) => {
  const url = await makeText(page, "key-sensitive-content");
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(url.split("#")[0]);
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "missing or invalid",
  );
  await recipient.goto(`${url.split("#")[0]}#key=${"A".repeat(43)}`);
  await recipient.getByRole("button", { name: "Reveal content" }).click();
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "Could not decrypt",
  );
  await context.close();
});

test("responsive themes, keyboard access, security headers and accessibility", async ({
  page,
}, testInfo) => {
  const response = await page.goto("/");
  const csp = response!.headers()["content-security-policy"];
  expect(csp).toContain("'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  await page.setViewportSize({ width: 1440, height: 1080 });
  await expect(
    page.getByRole("checkbox", { name: /Remember on this device/ }),
  ).not.toBeChecked();
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("workspace-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("body")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workspace-mobile-dark.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Short Link" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Private Drop" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "How it works" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
