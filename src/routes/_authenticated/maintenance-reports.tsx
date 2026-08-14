import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/maintenance-reports")({
  head: () => ({
    meta: [
      { title: "Maintenance Reports — FactoryOS AI" },
      { name: "description", content: "Live maintenance analytics, downloadable" },
    ],
  }),
  component: () => <RoleReports module="maintenance" />,
});
