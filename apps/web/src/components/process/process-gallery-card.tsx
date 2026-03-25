"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Workflow, User, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProcessStatusBadge } from "@/components/process/process-status-badge";
import { Badge } from "@/components/ui/badge";
import type { ProcessStatus } from "@grc/shared";

interface ProcessGalleryCardProps {
  id: string;
  name: string;
  status: ProcessStatus;
  level: number;
  ownerName?: string;
  updatedAt: string;
}

export function ProcessGalleryCard({
  id,
  name,
  status,
  level,
  ownerName,
  updatedAt,
}: ProcessGalleryCardProps) {
  const t = useTranslations("process");

  return (
    <Link href={`/processes/${id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          {/* Thumbnail placeholder */}
          <div className="flex items-center justify-center h-24 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-center">
              <Workflow className="mx-auto h-8 w-8 text-indigo-400" />
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {t(`levels.${level}` as Parameters<typeof t>[0])}
              </Badge>
            </div>
          </div>

          {/* Name + Status */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
              {name}
            </h3>
            <ProcessStatusBadge status={status} size="sm" />
          </div>

          {/* Meta */}
          <div className="space-y-1 text-xs text-gray-500">
            {ownerName && (
              <div className="flex items-center gap-1">
                <User size={12} />
                <span className="truncate">{ownerName}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{new Date(updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
