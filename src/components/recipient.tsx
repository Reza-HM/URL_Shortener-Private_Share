"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import jsonLanguage from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Download,
  FileText,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { decodeKey, decryptContent, type DecryptedContent } from "@/lib/crypto";
import { download, responseData, safeFilename } from "@/lib/client";
import type { DropMetadata } from "@/shared/contracts";
import { CopyButton, DateLabel, ErrorMessage } from "./common";

for (const [name, language] of Object.entries({
  javascript,
  typescript,
  json: jsonLanguage,
  css,
  xml,
  python,
  bash,
}))
  hljs.registerLanguage(name, language);

export function Recipient({ id }: { id: string }) {
  const [metadata, setMetadata] = useState<DropMetadata | null>(null),
    [key, setKey] = useState("");
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState("");
  const [content, setContent] = useState<DecryptedContent | null>(null),
    [claimed, setClaimed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    async function load() {
      const revision = ++generation.current;
      const current = () => alive && revision === generation.current;
      setLoading(true);
      setMetadata(null);
      setContent(null);
      setClaimed(false);
      setError("");
      setPassword("");
      setKey("");
      setBusy(false);
      try {
        const fragment =
          new URLSearchParams(window.location.hash.slice(1)).get("key") || "";
        decodeKey(fragment);
        if (current()) setKey(fragment);
        const data = await responseData<DropMetadata>(
          await fetch(`/api/v1/drops/${id}`, { cache: "no-store" }),
        );
        if (current()) setMetadata(data);
      } catch (error) {
        if (current())
          setError(
            error instanceof Error
              ? error.message
              : "This drop is unavailable.",
          );
      } finally {
        if (current()) setLoading(false);
      }
    }
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      alive = false;
      // This is a request revision counter, not a captured DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      window.removeEventListener("hashchange", load);
    };
  }, [id]);
  async function reveal(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const revision = generation.current;
    try {
      const response = await fetch(`/api/v1/drops/${id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        await responseData(response);
        return;
      }
      if (revision !== generation.current) return;
      setClaimed(true);
      const decrypted = await decryptContent(
        new Uint8Array(await response.arrayBuffer()),
        key,
      );
      if (revision !== generation.current) return;
      if (decrypted.metadata.kind !== metadata?.kind)
        throw new Error("This drop has inconsistent encrypted metadata.");
      setContent(decrypted);
      setPassword("");
      if (decrypted.metadata.kind === "file")
        download(decrypted.bytes, decrypted.metadata.filename || "download");
    } catch (error) {
      if (revision !== generation.current) return;
      setError(
        error instanceof Error
          ? error.message
          : "Could not open this drop. Please try again.",
      );
    } finally {
      if (revision === generation.current) setBusy(false);
    }
  }
  const text =
    content && content.metadata.kind !== "file"
      ? new TextDecoder().decode(content.bytes)
      : "";
  return (
    <div className="subpage">
      <Link href="/" className="text-button back-link">
        <ArrowLeft size={14} /> Back to workspace
      </Link>
      <div className="eyebrow">A PRIVATE HANDOFF</div>
      <h1>{content ? "Just for you." : "Something came your way."}</h1>
      <p className="subpage-intro">
        A private drop, encrypted from the start. The key in your link opens it
        here.
      </p>
      <section className="recipient-card" aria-label="Private Drop">
        {loading ? (
          <p className="loading-state" role="status">
            <LoaderCircle className="spin" size={18} /> Checking your drop…
          </p>
        ) : (
          <>
            <div className="recipient-icon">
              {metadata?.kind === "file" ? (
                <Paperclip size={24} />
              ) : content ? (
                <FileText size={24} />
              ) : (
                <LockKeyhole size={24} />
              )}
            </div>
            {metadata && (
              <div className="meta-row">
                <span>
                  <Clock3 size={12} />
                  <DateLabel value={metadata.expiresAt} />
                </span>
                {metadata.oneTime && (
                  <span>
                    <Zap size={12} /> One-time drop
                  </span>
                )}
                {metadata.requiresPassword && (
                  <span>
                    <KeyRound size={12} /> Password protected
                  </span>
                )}
              </div>
            )}
            {error && <ErrorMessage message={error} />}{" "}
            {content ? (
              <>
                {content.metadata.kind === "file" ? (
                  <>
                    <h2 className="filename">
                      {safeFilename(content.metadata.filename)}
                    </h2>
                    <p className="text-block">
                      {(content.bytes.byteLength / 1024).toFixed(1)} KiB ·
                      decrypted in your browser
                    </p>
                    <div className="button-row">
                      <button
                        className="primary-button"
                        onClick={() =>
                          download(
                            content.bytes,
                            content.metadata.filename || "download",
                          )
                        }
                      >
                        <Download size={16} /> Download again
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {content.metadata.kind === "code" ? (
                      <CodeView
                        text={text}
                        language={content.metadata.language || "plaintext"}
                      />
                    ) : (
                      <div className="drop-text" dir="auto">
                        {text}
                      </div>
                    )}
                    <div className="button-row">
                      <CopyButton value={text} label="Copy content" />
                      <button
                        className="secondary-button"
                        onClick={() =>
                          download(
                            content.bytes,
                            content.metadata.kind === "code"
                              ? "relay-code.txt"
                              : "relay-note.txt",
                          )
                        }
                      >
                        <Download size={16} /> Save as text
                      </button>
                    </div>
                  </>
                )}
                <p className="privacy-explanation recipient-bottom">
                  <ShieldCheck
                    size={13}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 5,
                    }}
                  />
                  {metadata?.oneTime
                    ? "This drop has been consumed. Keep this page open until you have saved what you need. It cannot be opened again."
                    : "This content was decrypted in your browser. Only you decide what to save."}
                </p>
              </>
            ) : metadata && !(claimed && metadata.oneTime) ? (
              <form onSubmit={reveal}>
                <div className="form-heading">
                  <h2>
                    {metadata.kind === "file"
                      ? "A file is waiting."
                      : "A private message is waiting."}
                  </h2>
                  <p>Nothing is revealed until you choose to open it.</p>
                </div>
                {metadata.requiresPassword && (
                  <label className="field-label">
                    Password
                    <input
                      autoComplete="off"
                      type="password"
                      placeholder="Enter the sender’s password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      maxLength={128}
                      disabled={busy}
                    />
                  </label>
                )}
                {metadata.oneTime && (
                  <p className="fine-print" style={{ marginBottom: 18 }}>
                    Opening consumes this drop before delivery. If the
                    connection fails, you may not be able to retry. The sender
                    cannot restore it.
                  </p>
                )}
                <button className="primary-button" disabled={busy}>
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Decrypting…
                    </>
                  ) : (
                    <>
                      {metadata.kind === "file"
                        ? "Reveal & download"
                        : "Reveal content"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : claimed && metadata?.oneTime ? (
              <p className="text-block">
                This one-time drop was consumed. Ask the sender to create a new
                drop with a fresh link.
              </p>
            ) : (
              <Link className="primary-button" href="/">
                Create your own share <ArrowRight size={16} />
              </Link>
            )}
          </>
        )}
      </section>
      <p className="privacy-explanation">
        Keep the complete link private. A lost or incomplete key cannot be
        recovered. Recipients can retain any content they reveal. Files are
        downloaded without executing or previewing them.
      </p>
    </div>
  );
}
function CodeView({ text, language }: { text: string; language: string }) {
  const result =
    language !== "plaintext" && hljs.getLanguage(language)
      ? hljs.highlight(text, { language, ignoreIllegals: true }).value
      : null;
  return (
    <pre className="code-view" tabIndex={0} aria-label="Shared code">
      {result !== null ? (
        <code dangerouslySetInnerHTML={{ __html: result }} />
      ) : (
        <code>{text}</code>
      )}
    </pre>
  );
}
