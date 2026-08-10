import { createFileRoute } from "@tanstack/react-router";
import { CompaniesView } from "./-companies-view";

export const Route = createFileRoute("/_authenticated/platform/suspended")({
  head: () => ({ meta: [{ title: "Suspended Companies — FactoryOS AI" }] }),
  component: () => (
    <CompaniesView
      filter="suspended"
      eyebrow="Platform"
      title="Suspended Companies"
      sub="Tenants whose access has been suspended by the platform owner."
    />
  ),
});
