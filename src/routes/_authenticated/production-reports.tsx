import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/production-reports")({
  head: () => ({
    meta: [
      { title: "Production Reports — FactoryOS AI" },
      { name: "description", content: "Live production analytics, downloadable" },
    ],
  }),
  component: () => <RoleReports module="production" />,
});
