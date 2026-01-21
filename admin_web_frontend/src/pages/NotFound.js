import React from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../components/ui";

// PUBLIC_INTERFACE
export default function NotFound() {
  /** This is a public page component for unknown routes. */
  return (
    <div className="ds-page">
      <Card title="Page not found" subtitle="The link you followed doesn’t exist.">
        <p className="ds-muted">
          Try returning to the dashboard.
        </p>
        <Link to="/">
          <Button>Go to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}

