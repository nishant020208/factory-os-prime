import { createFileRoute } from "@tanstack/react-router";
import { RoleReports } from "@/components/role-reports";

export const Route = createFileRoute("/_authenticated/platform/reports")({
  head: () => ({
    meta: [
      { title: "Platform Reports — FactoryOS AI" },
      {
        name: "description",
        content:
          "Platform-wide reports for Root Super Admin — companies, approvals, users by role and system health.",
      },
    ],
  }),
  component: () => <RoleReports module="platform" />,
});
