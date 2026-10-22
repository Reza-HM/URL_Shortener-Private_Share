"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  QrCode,
  X,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}
export function CopyButton({
  value,
  label = "Copy link",
  small = false,
}: {
  value: string;
  label?: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(true);
      setTimeout(() => {
        input.current?.focus();
        input.current?.select();
      }, 0);
    }
  }
  return (
    <span className="copy-control">
      <button
        type="button"
        className={small ? "secondary-button compact" : "primary-button"}
        onClick={copy}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <span aria-live="polite">{copied ? "Copied!" : label}</span>
      </button>
      {fallback && (
        <span className="copy-fallback">
          <label>
            Copy manually (Ctrl/Cmd+C)
            <textarea
              ref={input}
              rows={3}
              readOnly
              value={value}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        </span>
      )}
    </span>
  );
}
export function QRButton({ url }: { url: string }) {
  const [image, setImage] = useState(""),
    [error, setError] = useState("");
  async function generate() {
    try {
      setImage(
        await QRCode.toDataURL(url, {
          width: 480,
          margin: 3,
          color: { dark: "#163e38", light: "#ffffff" },
          errorCorrectionLevel: "M",
        }),
      );
    } catch {
      setError("This link is too long for a QR code. Copy the link instead.");
    }
  }
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) void generate();
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="secondary-button">
          <QrCode size={17} /> QR code
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content qr-dialog">
          <Dialog.Title>A scan away.</Dialog.Title>
          <Dialog.Description>
            This QR code contains the complete share link. Treat it like the
            link itself.
          </Dialog.Description>
          {image ? (
            <>
              <Image
                className="qr-image"
                src={image}
                width={240}
                height={240}
                alt="QR code for this share"
                unoptimized
              />
              <a
                className="primary-button full-width"
                href={image}
                download="relay-share.png"
              >
                <Download size={16} /> Download QR code
              </a>
            </>
          ) : error ? (
            <ErrorMessage message={error} />
          ) : (
            <p role="status">Creating your QR code…</p>
          )}
          <Dialog.Close
            className="dialog-close icon-button"
            aria-label="Close QR code"
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmButton({
  label,
  title,
  description,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="danger-button" type="button">
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {error && <ErrorMessage message={error} />}
          <div className="button-row">
            <Dialog.Close className="secondary-button" disabled={busy}>
              Keep it
            </Dialog.Close>
            <button
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Please try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Updating…" : label}
              <ArrowRight size={16} />
            </button>
          </div>
          <Dialog.Close
            className="dialog-close icon-button"
            aria-label="Close confirmation"
            disabled={busy}
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function DateLabel({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>
      {new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </time>
  ) : (
    <>No expiration</>
  );
}
export function ExternalAnchor({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-button">
      {children}
      <ExternalLink size={14} />
    </a>
  );
}
