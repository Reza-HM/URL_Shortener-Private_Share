"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  History,
  KeyRound,
  Link2,
  LockKeyhole,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import {
  clearHistory,
  forgetShare,
  listHistory,
  type LocalShare,
} from "@/lib/history";
import { ConfirmButton, CopyButton, DateLabel, ErrorMessage } from "./common";
export function HistoryView() {
  const [shares, setShares] = useState<LocalShare[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    listHistory()
      .then(setShares)
      .catch(() =>
        setError(
          "Device history is unavailable in this browser. Your saved management links still work.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="subpage">
      <div className="history-heading">
        <div>
          <div className="eyebrow">A LITTLE LOCAL MEMORY</div>
          <h1>My shares.</h1>
        </div>
        {shares.length > 0 && (
          <ConfirmButton
            label="Clear history"
            title="Forget these links?"
            description="This only removes links from this browser. It does not delete the shares. Keep any management links you still need."
            onConfirm={async () => {
              await clearHistory();
              setShares([]);
            }}
          />
        )}
      </div>
      <p className="subpage-intro">
        Only shares you chose to remember on this device appear here.
      </p>
      {error && <ErrorMessage message={error} />}{" "}
      {loading ? (
        <p className="loading-state" role="status">
          <LoaderCircle className="spin" size={18} /> Checking this browser…
        </p>
      ) : shares.length ? (
        <div className="history-list">
          {shares.map((share) => (
            <article className="history-item" key={share.id}>
              <div className="history-item-head">
                {share.kind === "link" ? (
                  <Link2 size={18} />
                ) : (
                  <LockKeyhole size={18} />
                )}
                <div>
                  <strong>{share.label}</strong>
                  <p>
                    {share.kind === "link" ? "Short link" : "Private drop"} ·{" "}
                    <DateLabel value={share.expiresAt} />
                    {share.expiresAt && new Date(share.expiresAt) <= new Date()
                      ? " · expired"
                      : ""}
                  </p>
                </div>
              </div>
              <div className="button-row">
                <CopyButton value={share.shareUrl} small />
                <Link className="text-button" href={share.shareUrl}>
                  Open <ArrowUpRight size={13} />
                </Link>
                <Link className="text-button" href={share.managementUrl}>
                  Manage <KeyRound size={12} />
                </Link>
                <button
                  className="text-button forget-button"
                  onClick={async () => {
                    try {
                      await forgetShare(share.id);
                      setShares((items) =>
                        items.filter((item) => item.id !== share.id),
                      );
                    } catch {
                      setError(
                        "Could not forget this share. Please try again.",
                      );
                    }
                  }}
                >
                  <Trash2 size={12} /> Forget
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="history-card history-empty">
          <History size={34} />
          <h2>A fresh start.</h2>
          <p>
            Create a share and choose “Remember on this device” to keep it here.
            Nothing is saved automatically.
          </p>
          <Link href="/" className="primary-button">
            Make your first share <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <p className="history-warning">
        <KeyRound size={17} />
        <span>
          This history contains complete share links and private management
          capabilities. Anyone using this browser may access them. Clearing
          browser data loses these links; forgetting a link does not delete its
          share.
        </span>
      </p>
    </div>
  );
}
