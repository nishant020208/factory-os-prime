import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions — FactoryOS AI" },
      { name: "description", content: "Configure application roles and fine-grained permissions" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Roles & Permissions"
      sub="Configure application roles and fine-grained permissions"
    />
  ),
});
