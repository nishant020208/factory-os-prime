import { createFileRoute } from "@tanstack/react-router";
import { CompaniesView } from "./-companies-view";

export const Route = createFileRoute("/_authenticated/platform/companies")({
  head: () => ({ meta: [{ title: "Approved Companies — FactoryOS AI" }] }),
  component: () => <CompaniesView filter="active" eyebrow="Platform" title="Approved Companies" sub="Active tenants running on the FactoryOS platform." />,
});
