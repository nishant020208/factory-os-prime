import { createFileRoute } from "@tanstack/react-router";
import { CompaniesView } from "./-companies-view";

export const Route = createFileRoute("/_authenticated/platform/pending")({
  head: () => ({ meta: [{ title: "Pending Companies — FactoryOS AI" }] }),
  component: () => <CompaniesView filter="pending" eyebrow="Platform" title="Pending Company Requests" sub="Company Admins who signed up but haven't been approved yet." />,
});
