"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Link2, LoaderCircle } from "lucide-react";
import { responseData } from "@/lib/client";
import { DateLabel, ErrorMessage } from "./common";
export function LinkPreview({ code }: { code: string }) {
  const [data, setData] = useState<{
      destination: string;
      expiresAt: string | null;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/links/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(responseData<{ destination: string; expiresAt: string | null }>)
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((error) => {
        if (alive)
          setError(
            error instanceof Error
              ? error.message
              : "This link is unavailable.",
          );
      });
    return () => {
      alive = false;
    };
  }, [code]);
  return (
    <div className="subpage">
      <Link href="/" className="text-button back-link">
        <ArrowLeft size={14} /> Back to workspace
      </Link>
      <div className="eyebrow">LOOK BEFORE YOU LEAP</div>
      <h1>Here’s where it goes.</h1>
      <p className="subpage-intro">The full destination, before you open it.</p>
      <section className="recipient-card">
        <div className="recipient-icon">
          <Link2 size={24} />
        </div>
        {error ? (
          <ErrorMessage message={error} />
        ) : data ? (
          <>
            <p className="field-label">Destination</p>
            <div className="destination-box" dir="auto">
              {data.destination}
            </div>
            <p className="fine-print">
              Expires: <DateLabel value={data.expiresAt} />
            </p>
            <div className="button-row">
              <a
                className="primary-button"
                href={`/s/${encodeURIComponent(code)}`}
                rel="noreferrer"
              >
                Continue to destination <ArrowUpRight size={16} />
              </a>
            </div>
            <p className="privacy-explanation">
              This preview does not fetch or endorse the destination. Continue
              only if you trust the sender.
            </p>
          </>
        ) : (
          <p className="loading-state" role="status">
            <LoaderCircle size={18} className="spin" /> Loading destination…
          </p>
        )}
      </section>
    </div>
  );
}
