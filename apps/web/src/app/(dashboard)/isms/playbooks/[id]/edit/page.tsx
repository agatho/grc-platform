"use client";

import { use } from "react";
import { ModuleGate } from "@/components/module/module-gate";
import { PlaybookEditor } from "@/components/isms/playbook-editor";

export default function EditPlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ModuleGate moduleKey="isms">
      <PlaybookEditor mode="edit" playbookId={id} />
    </ModuleGate>
  );
}
