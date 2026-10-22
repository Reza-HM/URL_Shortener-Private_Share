"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import { responseData } from "@/lib/client";
import type { ManagedShare } from "@/shared/contracts";
import { ConfirmButton, CopyButton, DateLabel, ErrorMessage } from "./common";

export function Management({ id }: { id: string }) {
  const [share, setShare] = useState<ManagedShare | null>(null),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    let sequence = 0;
    async function load() {
      const revision = ++sequence;
      const current = () => alive && revision === sequence;
      const capability =
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      setLoading(true);
      setError("");
      setShare(null);
      setToken("");
      try {
        if (!/^[A-Za-z0-9_-]{43}$/.test(capability))
          throw new Error(
            "This management link is incomplete. Use the full private link saved when the share was created.",
          );
        const data = await responseData<ManagedShare>(
          await fetch(`/api/v1/manage/${id}`, {
            headers: { Authorization: `Bearer ${capability}` },
            cache: "no-store",
          }),
        );
        if (current()) {
          setToken(capability);
          setShare(data);
        }
      } catch (error) {
        if (current())
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this share.",
          );
      } finally {
        if (current()) setLoading(false);
      }
    }
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", load);
    };
  }, [id]);
  async function action(action: "disable" | "delete") {
    const result = await responseData<ManagedShare>(
      await fetch(`/api/v1/manage/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      }),
    );
    setShare(result);
  }
  return (
    <div className="subpage">
      <Link href="/" className="text-button back-link">
        <ArrowLeft size={14} /> Back to workspace
      </Link>
      <div className="eyebrow">
        <KeyRound size={13} /> YOUR PRIVATE CONTROL ROOM
      </div>
      <h1>A share, on your terms.</h1>
      <p className="subpage-intro">
        This page is yours. Anyone with this management link can control this
        share.
      </p>
      <section className="management-card" aria-label="Manage share">
        {loading ? (
          <p className="loading-state" role="status">
            <LoaderCircle size={18} className="spin" /> Loading your share…
          </p>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          share && (
            <>
              <span className="status-pill">{share.status}</span>
              <h2 style={{ marginTop: 14, fontSize: 21 }}>
                {share.kind === "link"
                  ? "Your short link"
                  : "Your private drop"}
              </h2>
              {share.destination && (
                <>
                  <p className="field-label" style={{ marginTop: 18 }}>
                    Destination
                  </p>
                  <div className="destination-box" dir="auto">
                    {share.destination}
                  </div>
                </>
              )}
              <dl className="stat-grid">
                <div>
                  <dt>
                    {share.kind === "link"
                      ? "Redirect requests"
                      : "Successful reveals"}
                  </dt>
                  <dd>{share.requests.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>
                    <DateLabel value={share.expiresAt} />
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>
                    <DateLabel value={share.createdAt} />
                  </dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>
                    {share.kind === "link"
                      ? "Anyone with the link"
                      : `${share.oneTime ? "One-time" : "Until expiry"}${share.requiresPassword ? " · password" : ""}`}
                  </dd>
                </div>
              </dl>
              {share.kind === "link" && share.code && (
                <div className="button-row">
                  <CopyButton
                    value={`${window.location.origin}/s/${share.code}`}
                  />
                  <Link href={`/preview/${share.code}`} className="text-button">
                    Preview destination
                  </Link>
                </div>
              )}
              {share.status === "active" && (
                <div className="button-row">
                  {share.kind === "link" && (
                    <ConfirmButton
                      label="Disable link"
                      title="Stop this link?"
                      description="The destination will no longer open through this short link. This cannot be undone."
                      onConfirm={() => action("disable")}
                    />
                  )}
                  <ConfirmButton
                    label="Delete share"
                    title="Take this share back?"
                    description="Recipients will no longer be able to access it. Already saved copies cannot be removed. This cannot be undone."
                    onConfirm={() => action("delete")}
                  />
                </div>
              )}
              {share.status === "disabled" && (
                <div className="button-row">
                  <ConfirmButton
                    label="Delete share"
                    title="Delete this share?"
                    description="Permanently mark this share as deleted."
                    onConfirm={() => action("delete")}
                  />
                </div>
              )}
              <p className="privacy-explanation recipient-bottom">
                {share.kind === "link"
                  ? "Request counts are aggregate redirects, not unique people. HEAD checks and destination previews do not increase the count."
                  : "This page never receives your content’s decryption key. Deletion blocks future access immediately; background cleanup removes stored ciphertext."}
              </p>
            </>
          )
        )}
      </section>
    </div>
  );
}
