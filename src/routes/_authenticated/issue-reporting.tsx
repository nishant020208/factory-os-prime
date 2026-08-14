import { createFileRoute } from "@tanstack/react-router";
import { OperatorIssueReporting } from "@/components/operator-workspace";

export const Route = createFileRoute("/_authenticated/issue-reporting")({
  head: () => ({
    meta: [
      { title: "Report an Issue — FactoryOS AI" },
      { name: "description", content: "Report machine or quality issues" },
    ],
  }),
  component: OperatorIssueReporting,
});
