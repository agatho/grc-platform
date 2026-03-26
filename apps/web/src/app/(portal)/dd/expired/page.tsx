"use client";

import { AlertTriangle } from "lucide-react";

export default function DdExpiredPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-red-50 p-4 mb-6">
        <AlertTriangle size={40} className="text-red-500" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Questionnaire Expired
      </h1>

      <p className="text-gray-600 max-w-md mb-6">
        The deadline for this questionnaire has passed. The access link is no
        longer valid.
      </p>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 max-w-md">
        <p className="text-sm text-gray-600">
          Please contact the requesting organization for a deadline extension.
          They can issue a new invitation link.
        </p>
      </div>
    </div>
  );
}
