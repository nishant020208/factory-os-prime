import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — FactoryOS AI" },
      {
        name: "description",
        content:
          "Role-scoped live reports — every number computed from the real database through row-level security, downloadable as CSV/PDF.",
      },
    ],
  }),
  component: () => <RoleReports />,
});
