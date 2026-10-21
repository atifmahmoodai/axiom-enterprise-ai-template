import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-container not-found">
      <p className="eyebrow">404 · ROUTE NOT FOUND</p>
      <h1>Outside the network.</h1>
      <p>
        This page doesn’t exist. Your next step is back at the control plane.
      </p>
      <Link className="button button-primary" href="/">
        Return to Axiom
      </Link>
    </div>
  );
}
