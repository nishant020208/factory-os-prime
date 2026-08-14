import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/quality-reports")({
  head: () => ({
    meta: [
      { title: "Quality Reports — FactoryOS AI" },
      { name: "description", content: "Live quality analytics, downloadable" },
    ],
  }),
  component: () => <RoleReports module="quality" />,
});
