import Link from "next/link";
export default function NotFound() {
  return (
    <div className="not-found">
      <div className="eyebrow" style={{ justifyContent: "center" }}>
        A SMALL DETOUR
      </div>
      <h1>Nothing at this address.</h1>
      <p>
        The link may be incomplete. Check it with the sender, or start something
        new.
      </p>
      <Link className="primary-button" href="/">
        Back to workspace
      </Link>
    </div>
  );
}
