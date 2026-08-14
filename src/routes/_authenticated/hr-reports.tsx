import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/hr-reports")({
  head: () => ({
    meta: [
      { title: "HR Reports — FactoryOS AI" },
      { name: "description", content: "Live HR analytics, downloadable" },
    ],
  }),
  component: () => <RoleReports module="hr" />,
});
