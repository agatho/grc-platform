"use client";

import React from "react";
import { cn } from "../../utils";

interface RoleCommentFieldsProps {
  commentRiskOwner: string;
  commentRiskManager: string;
  commentManagement: string;
  currentUserRole: string;
  onChange: (field: string, value: string) => void;
  labels?: {
    riskOwner: string;
    riskManager: string;
    management: string;
    noComment: string;
  };
}

export function RoleCommentFields({
  commentRiskOwner,
  commentRiskManager,
  commentManagement,
  currentUserRole,
  onChange,
  labels,
}: RoleCommentFieldsProps) {
  const sections = [
    {
      field: "comment_risk_owner",
      value: commentRiskOwner,
      label: labels?.riskOwner ?? "Comment Risk Owner",
      editableRoles: ["admin", "risk_owner", "control_owner", "process_owner"],
    },
    {
      field: "comment_risk_manager",
      value: commentRiskManager,
      label: labels?.riskManager ?? "Comment Risk Manager",
      editableRoles: ["admin", "risk_manager"],
    },
    {
      field: "comment_management",
      value: commentManagement,
      label: labels?.management ?? "Comment Management",
      editableRoles: ["admin"],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const isEditable = section.editableRoles.includes(currentUserRole);
        return (
          <div
            key={section.field}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                {section.label}
              </span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  isEditable
                    ? "bg-teal-100 text-teal-700"
                    : "bg-gray-100 text-gray-500",
                )}
              >
                {isEditable ? "Edit" : "Locked"}
              </span>
            </div>
            <div className="p-4">
              {isEditable ? (
                <textarea
                  value={section.value}
                  onChange={(e) => onChange(section.field, e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  maxLength={5000}
                />
              ) : (
                <p
                  className={cn(
                    "text-sm",
                    section.value ? "text-gray-700" : "text-gray-400 italic",
                  )}
                >
                  {section.value || (labels?.noComment ?? "No comment yet")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
