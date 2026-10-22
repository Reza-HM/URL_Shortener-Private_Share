import Link from "next/link";
export const metadata = { title: "Share unavailable" };
export default function UnavailablePage() {
  return (
    <div className="not-found">
      <div className="eyebrow" style={{ justifyContent: "center" }}>
        THIS HANDOFF HAS ENDED
      </div>
      <h1>That link has moved on.</h1>
      <p>
        It may have expired, been disabled, or been deleted. Check with the
        sender for a fresh link.
      </p>
      <Link className="primary-button" href="/">
        Make a new share
      </Link>
    </div>
  );
}
