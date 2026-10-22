"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowRight,
  ArrowUpRight,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Clock3,
  ChevronDown,
  Check,
  Upload,
  FileText,
  Code2,
  Paperclip,
  X,
  Sparkles,
  KeyRound,
  Zap,
  LoaderCircle,
} from "lucide-react";
import { encryptContent } from "@/lib/crypto";
import { rememberShare, type LocalShare } from "@/lib/history";
import { postJson, uploadDrop } from "@/lib/client";
import {
  dropInput,
  linkInput,
  TEXT_LIMIT,
  type CreatedShare,
  type Expiry,
} from "@/shared/contracts";
import { normalizeDestination } from "@/domain/policy";
import { CopyButton, DateLabel, ErrorMessage, QRButton } from "./common";

const expiryOptions = (
  <>
    <option value="5m">5 minutes</option>
    <option value="1h">1 hour</option>
    <option value="24h">24 hours</option>
    <option value="7d">7 days</option>
  </>
);
const names = {
  "5m": "5 minutes",
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
};

export function Workspace({ maxFileBytes }: { maxFileBytes: number }) {
  const [mode, setMode] = useState("link"),
    [kind, setKind] = useState<"text" | "code" | "file">("text");
  const [destination, setDestination] = useState(""),
    [alias, setAlias] = useState("");
  const [text, setText] = useState(""),
    [language, setLanguage] = useState("javascript"),
    [file, setFile] = useState<File | null>(null);
  const [linkExpiry, setLinkExpiry] = useState("never"),
    [dropExpiry, setDropExpiry] = useState<Expiry>("24h");
  const [passwordEnabled, setPasswordEnabled] = useState(false),
    [password, setPassword] = useState(""),
    [oneTime, setOneTime] = useState(false),
    [remember, setRemember] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState(""),
    [progress, setProgress] = useState(0);
  const [result, setResult] = useState<LocalShare | null>(null),
    [historyNote, setHistoryNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    resultHeading = useRef<HTMLHeadingElement>(null);
  const isDrop = mode === "drop";
  function chooseFile(value: File | null) {
    setError("");
    if (value && value.size > maxFileBytes) {
      setError(
        `Choose a file smaller than ${Math.round(maxFileBytes / 1024 / 1024)} MiB.`,
      );
      return;
    }
    setFile(value);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    setProgress(0);
    setHistoryNote("");
    try {
      let created: CreatedShare,
        key = "",
        label: string;
      if (!isDrop) {
        const input = linkInput.parse({
          destination,
          ...(alias.trim() ? { alias } : {}),
          expiresIn: linkExpiry === "never" ? null : linkExpiry,
        });
        normalizeDestination(input.destination, window.location.origin);
        setPhase("Making your link…");
        created = await postJson<CreatedShare>("/api/v1/links", input);
        label = new URL(input.destination).hostname;
      } else {
        const options = dropInput.parse({
          kind,
          expiresIn: dropExpiry,
          oneTime,
          ...(passwordEnabled ? { password } : {}),
        });
        if (kind === "file" && !file)
          throw new Error("Choose a file to share.");
        if (kind !== "file" && !text.length)
          throw new Error("Add some text or code to share.");
        if (
          kind !== "file" &&
          new TextEncoder().encode(text).byteLength > TEXT_LIMIT
        )
          throw new Error("Text and code must be 1 MiB or smaller.");
        if (file && kind === "file" && file.size > maxFileBytes)
          throw new Error("This file exceeds the size limit.");
        setPhase("Encrypting in your browser…");
        const bytes =
          kind === "file"
            ? new Uint8Array(await file!.arrayBuffer())
            : new TextEncoder().encode(text);
        const encrypted = await encryptContent(bytes, {
          version: 1,
          kind,
          ...(kind === "code" ? { language } : {}),
          ...(kind === "file"
            ? { filename: file!.name, mime: file!.type.slice(0, 256) }
            : {}),
        });
        key = encrypted.key;
        setPhase("Sending encrypted content…");
        created = await uploadDrop(options, encrypted.payload, setProgress);
        label =
          kind === "file"
            ? file!.name
            : kind === "code"
              ? "Code drop"
              : "Text drop";
      }
      const share: LocalShare = {
        id: created.id,
        kind: isDrop ? "drop" : "link",
        label,
        shareUrl: `${window.location.origin}${created.sharePath}${key ? `#key=${key}` : ""}`,
        managementUrl: `${window.location.origin}${created.managementPath}#token=${created.managementToken}`,
        createdAt: Date.now(),
        expiresAt: created.expiresAt,
      };
      if (remember) {
        try {
          await rememberShare(share);
        } catch {
          setHistoryNote(
            "Created successfully, but this browser could not save device history. Keep the management link below.",
          );
        }
      }
      setResult(share);
      setText("");
      setFile(null);
      setPassword("");
      setTimeout(() => resultHeading.current?.focus(), 0);
    } catch (error) {
      const issue = error as {
        issues?: { message: string }[];
        message?: string;
      };
      setError(
        issue.issues?.[0]?.message ||
          issue.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
      setPhase("");
    }
  }
  return (
    <div className="workspace page-width">
      <section className="workspace-intro">
        <div>
          <div className="eyebrow">
            <span className="status-dot" /> GOOD THINGS ARE MEANT TO BE SHARED
          </div>
          <h1>
            A little link.
            <br />A lot of possibility<span className="accent">.</span>
          </h1>
          <p>
            Send a destination. Pass a thought. Share something privately.
            <br className="desktop-break" /> All without the extra steps.
          </p>
        </div>
        <div className="intro-note">
          <span className="handdrawn-arrow">↙</span>
          <span>
            For the things
            <br />
            worth passing on.
          </span>
        </div>
      </section>
      <div className="workspace-grid">
        <section className="composer-card" aria-label="Create a share">
          {result ? (
            <div className="result-panel">
              <div className="success-mark">
                <Check size={27} />
              </div>
              <span className="eyebrow">READY FOR THE HANDOFF</span>
              <h2 ref={resultHeading} tabIndex={-1}>
                {result.kind === "link"
                  ? "Small link. Big potential."
                  : "Your drop is ready."}
              </h2>
              <p>
                {result.kind === "drop"
                  ? "Only the complete link can unlock this content. Send it to someone you trust."
                  : "Your destination, with a little less baggage. Send this link anywhere."}
              </p>
              <label className="field-label" htmlFor="share-url">
                Share link
              </label>
              <input
                id="share-url"
                className="share-url"
                value={result.shareUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="button-row">
                <CopyButton value={result.shareUrl} />
                <QRButton url={result.shareUrl} />
              </div>
              <div className="result-expiry">
                <Clock3 size={15} />
                <DateLabel value={result.expiresAt} />
              </div>
              <div className="management-note">
                <KeyRound size={19} />
                <div>
                  <strong>One more link. Just for you.</strong>
                  <p>
                    Keep this private to manage or delete your share. It cannot
                    be recovered if you lose it.
                  </p>
                  <div className="button-row">
                    <CopyButton
                      value={result.managementUrl}
                      label="Copy management link"
                      small
                    />
                    <Link className="text-button" href={result.managementUrl}>
                      Manage share <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
              {historyNote && <ErrorMessage message={historyNote} />}
              <button
                className="text-button create-another"
                onClick={() => {
                  setResult(null);
                  setError("");
                }}
              >
                Make another share <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <Tabs.Root
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setError("");
              }}
            >
              <div className="composer-top">
                <Tabs.List
                  className="mode-tabs"
                  aria-label="What would you like to share?"
                >
                  <Tabs.Trigger
                    className="mode-tab"
                    value="link"
                    disabled={busy}
                  >
                    <Link2 size={17} /> Short Link
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    className="mode-tab"
                    value="drop"
                    disabled={busy}
                  >
                    <LockKeyhole size={17} /> Private Drop
                  </Tabs.Trigger>
                </Tabs.List>
                <span className="composer-step">MAKE SOMETHING SHAREABLE</span>
              </div>
              <form onSubmit={submit}>
                <fieldset disabled={busy} className="composer-fieldset">
                  <Tabs.Content value="link">
                    <div className="form-heading">
                      <h2>Long URL. Short story.</h2>
                      <p>Give your next destination a smaller address.</p>
                    </div>
                    <label className="field-label" htmlFor="destination">
                      Destination URL <span>REQUIRED</span>
                    </label>
                    <div className="input-with-icon">
                      <Link2 size={18} />
                      <input
                        id="destination"
                        placeholder="https://somewhere.worth.sharing/a-long-story"
                        type="url"
                        autoComplete="off"
                        required={!isDrop}
                        value={destination}
                        onChange={(event) => setDestination(event.target.value)}
                        maxLength={8192}
                      />
                    </div>
                    <p className="field-hint">
                      Any HTTP or HTTPS address. We keep the destination intact.
                    </p>
                    <details className="advanced-options">
                      <summary>
                        Make it yours{" "}
                        <span>
                          Alias & expiration <ChevronDown size={15} />
                        </span>
                      </summary>
                      <div className="advanced-grid">
                        <label className="field-label">
                          Custom alias{" "}
                          <input
                            placeholder="your-next-big-thing"
                            value={alias}
                            onChange={(event) => setAlias(event.target.value)}
                            maxLength={48}
                          />
                          <small>
                            Optional · 4–48 letters, numbers or hyphens
                          </small>
                        </label>
                        <label className="field-label">
                          Expires after
                          <select
                            value={linkExpiry}
                            onChange={(event) =>
                              setLinkExpiry(event.target.value)
                            }
                          >
                            <option value="never">Never</option>
                            {expiryOptions}
                          </select>
                        </label>
                      </div>
                    </details>
                  </Tabs.Content>
                  <Tabs.Content value="drop">
                    <div className="form-heading">
                      <h2>A private little handoff.</h2>
                      <p>
                        Encrypted here. Opened only with your complete link.
                      </p>
                    </div>
                    <div
                      className="content-types"
                      aria-label="Drop content type"
                    >
                      {(
                        [
                          { value: "text", label: "Text", icon: FileText },
                          { value: "code", label: "Code", icon: Code2 },
                          { value: "file", label: "File", icon: Paperclip },
                        ] as const
                      ).map(({ value, label, icon: Icon }) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={kind === value}
                          onClick={() => setKind(value)}
                        >
                          <Icon size={15} />
                          {label}
                        </button>
                      ))}
                    </div>
                    {kind === "file" ? (
                      <>
                        <label
                          className={`file-zone ${file ? "has-file" : ""}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!busy)
                              chooseFile(event.dataTransfer.files[0] || null);
                          }}
                        >
                          <span className="upload-icon">
                            {file ? (
                              <Paperclip size={24} />
                            ) : (
                              <Upload size={24} />
                            )}
                          </span>
                          <strong>
                            {file ? file.name : "A file worth passing on"}
                          </strong>
                          <span>
                            {file
                              ? `${(file.size / 1024).toFixed(1)} KiB · click to change`
                              : "Drop it here, or click to browse"}
                          </span>
                          <small>
                            One file, up to{" "}
                            {Math.round(maxFileBytes / 1024 / 1024)} MiB ·
                            filename encrypted too
                          </small>
                          <input
                            ref={fileInput}
                            aria-label="Choose a file"
                            type="file"
                            onChange={(event) =>
                              chooseFile(event.target.files?.[0] || null)
                            }
                          />
                        </label>
                        {file && (
                          <button
                            type="button"
                            className="text-button remove-file"
                            onClick={() => {
                              setFile(null);
                              if (fileInput.current)
                                fileInput.current.value = "";
                            }}
                          >
                            <X size={14} /> Remove file
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="editor-label">
                          <label className="field-label" htmlFor="drop-content">
                            {kind === "code" ? "Your code" : "Your text"}
                          </label>
                          {kind === "code" && (
                            <select
                              aria-label="Code language"
                              className="language-select"
                              value={language}
                              onChange={(event) =>
                                setLanguage(event.target.value)
                              }
                            >
                              <option value="javascript">JavaScript</option>
                              <option value="typescript">TypeScript</option>
                              <option value="json">JSON</option>
                              <option value="css">CSS</option>
                              <option value="xml">HTML</option>
                              <option value="python">Python</option>
                              <option value="bash">Shell</option>
                              <option value="plaintext">Plain text</option>
                            </select>
                          )}
                        </div>
                        <textarea
                          id="drop-content"
                          className={kind === "code" ? "code-input" : ""}
                          dir="auto"
                          value={text}
                          onChange={(event) => setText(event.target.value)}
                          placeholder={
                            kind === "code"
                              ? "// A good idea starts here…"
                              : "A thought, a note, something just for them…"
                          }
                          rows={7}
                          required={isDrop}
                        />
                        <div className="editor-footer">
                          <span>
                            <LockKeyhole size={12} /> Encrypted before it leaves
                            your browser
                          </span>
                          <span>
                            {new TextEncoder()
                              .encode(text)
                              .byteLength.toLocaleString()}{" "}
                            / 1 MiB
                          </span>
                        </div>
                      </>
                    )}
                    <details className="advanced-options">
                      <summary>
                        Set the ground rules{" "}
                        <span>
                          Privacy & expiration <ChevronDown size={15} />
                        </span>
                      </summary>
                      <div className="drop-settings">
                        <label className="field-label">
                          Expires after
                          <select
                            value={dropExpiry}
                            onChange={(event) =>
                              setDropExpiry(event.target.value as Expiry)
                            }
                          >
                            {expiryOptions}
                          </select>
                        </label>
                        <label className="switch-row">
                          <span>
                            <strong>Password protection</strong>
                            <small>
                              An additional access gate, separate from
                              encryption.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={passwordEnabled}
                            onChange={(event) =>
                              setPasswordEnabled(event.target.checked)
                            }
                          />
                        </label>
                        {passwordEnabled && (
                          <label className="field-label">
                            Drop password
                            <input
                              type="password"
                              autoComplete="new-password"
                              minLength={8}
                              maxLength={128}
                              placeholder="At least 8 characters"
                              value={password}
                              onChange={(event) =>
                                setPassword(event.target.value)
                              }
                              required={passwordEnabled}
                            />
                          </label>
                        )}
                        <label className="switch-row">
                          <span>
                            <strong>One-time reveal</strong>
                            <small>
                              Only the first successful reveal receives the
                              content.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={oneTime}
                            onChange={(event) =>
                              setOneTime(event.target.checked)
                            }
                          />
                        </label>
                        {oneTime && (
                          <p className="fine-print">
                            A successful reveal consumes the drop before
                            delivery. An interrupted connection can still use it
                            up.
                          </p>
                        )}
                      </div>
                    </details>
                    <div className="setting-chips">
                      <span>
                        <Clock3 size={13} /> {names[dropExpiry]}
                      </span>
                      {passwordEnabled && (
                        <span>
                          <KeyRound size={13} /> Password
                        </span>
                      )}
                      {oneTime && (
                        <span>
                          <Zap size={13} /> One-time
                        </span>
                      )}
                    </div>
                  </Tabs.Content>
                  <label className="remember-choice">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    <span>
                      Remember on this device
                      <small>
                        Saves private links in this browser. Avoid on shared
                        devices.
                      </small>
                    </span>
                  </label>
                  {error && <ErrorMessage message={error} />}
                  <button
                    type="submit"
                    className="primary-button submit-button"
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="spin" size={18} />
                        {phase}
                      </>
                    ) : (
                      <>
                        {isDrop ? "Create private drop" : "Shorten link"}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                  {busy && isDrop && (
                    <div
                      className="upload-progress"
                      role="progressbar"
                      aria-label="Encrypted upload progress"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <div className="composer-footnote">
                    <ShieldCheck size={14} />
                    {isDrop
                      ? "Your content is encrypted. Your account is unnecessary."
                      : "No sign-up. No detours. Just a shorter way there."}
                  </div>
                </fieldset>
              </form>
            </Tabs.Root>
          )}
        </section>
        <aside className="workspace-aside">
          <div className="handoff-card">
            <div className="card-eyebrow">
              <Sparkles size={14} /> A SMALLER WAY TO SHARE
            </div>
            <h2>
              Less in the way.
              <br />
              More on the
              <br />
              <span>other side.</span>
            </h2>
            <div className="link-illustration" aria-hidden="true">
              <div className="long-link">
                <span className="tiny-globe">↗</span> somewhere.com / a / really
                / long /…
              </div>
              <div className="illustration-connector">
                <span />
                <ArrowRight size={17} />
              </div>
              <div className="short-link">
                <span className="mini-mark">
                  <ArrowUpRight size={18} />
                </span>{" "}
                relay / good-things{" "}
                <span className="tiny-check">
                  <Check size={12} />
                </span>
              </div>
            </div>
            <div className="handoff-card-footer">
              <span className="status-dot" /> A good connection starts small.
            </div>
          </div>
          <div className="promise-list">
            <div>
              <span className="promise-icon">
                <ShieldCheck size={19} />
              </span>
              <div>
                <h3>Private by design</h3>
                <p>
                  Drops are encrypted in your browser.
                  <br />
                  The complete link holds the key.
                </p>
              </div>
            </div>
            <div>
              <span className="promise-icon">
                <Clock3 size={19} />
              </span>
              <div>
                <h3>On your terms</h3>
                <p>
                  Set an expiry, add a password,
                  <br />
                  or make it a one-time thing.
                </p>
              </div>
            </div>
            <div>
              <span className="promise-icon">
                <KeyRound size={19} />
              </span>
              <div>
                <h3>Yours to control</h3>
                <p>
                  Keep your management link.
                  <br />
                  Take it back whenever you need.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <section className="how-strip" aria-label="Three steps to sharing">
        <div>
          <span>01</span>
          <div>
            <h3>Make it shareable</h3>
            <p>A URL, a note, a file. Start with what matters.</p>
          </div>
        </div>
        <div>
          <span>02</span>
          <div>
            <h3>Set your boundaries</h3>
            <p>A little privacy. An expiration. Your call.</p>
          </div>
        </div>
        <div>
          <span>03</span>
          <div>
            <h3>Pass it on</h3>
            <p>One link. The right person. Done.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
