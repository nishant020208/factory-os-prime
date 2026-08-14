import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/finance-reports")({
  head: () => ({
    meta: [
      { title: "Finance Reports — FactoryOS AI" },
      { name: "description", content: "Live finance analytics, downloadable" },
    ],
  }),
  component: () => <RoleReports module="finance" />,
});
