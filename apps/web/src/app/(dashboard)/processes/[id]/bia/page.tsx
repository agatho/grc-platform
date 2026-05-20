"use client";

// BPM Overhaul Phase 4: Per-process BIA view — same data as the tab but
// dedicated route for BCM Managers who navigate by process.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProcessBiaTab } from "@/components/process/process-bia-tab";

export default function ProcessBiaPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <Link
          href={`/processes/${processId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to process
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" /> Business Impact Analysis
            </h1>
            <p className="text-sm text-muted-foreground">
              MTPD / RTO / RPO and impact dimensions for this process across all
              BIAs
            </p>
          </div>
          <Link href="/bcms/bia/new">
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> New BIA
            </Button>
          </Link>
        </div>

        <ProcessBiaTab processId={processId} />
      </div>
    </ModuleGate>
  );
}
