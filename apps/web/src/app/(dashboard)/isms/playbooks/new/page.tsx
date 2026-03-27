"use client";

import { ModuleGate } from "@/components/module/module-gate";
import { PlaybookEditor } from "@/components/isms/playbook-editor";

export default function NewPlaybookPage() {
  return (
    <ModuleGate moduleKey="isms">
      <PlaybookEditor mode="create" />
    </ModuleGate>
  );
}
