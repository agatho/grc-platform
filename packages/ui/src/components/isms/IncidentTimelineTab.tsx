"use client";

import React, { useState } from "react";
import { cn } from "../../utils";

interface TimelineEntry {
  id: string;
  eventType: string;
  description: string;
  occurredAt: string;
  createdByName: string | null;
}

interface IncidentTimelineTabProps {
  entries: TimelineEntry[];
  onAddEntry: (entry: { eventType: string; description: string; occurredAt?: string }) => void;
  canEdit: boolean;
  labels?: {
    title: string;
    addEntry: string;
    eventType: string;
    description: string;
    occurredAt: string;
    save: string;
    cancel: string;
  };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  detected: "bg-blue-100 text-blue-700",
  reported: "bg-blue-100 text-blue-700",
  escalated: "bg-orange-100 text-orange-700",
  contained: "bg-green-100 text-green-700",
  mitigated: "bg-green-100 text-green-700",
  resolved: "bg-teal-100 text-teal-700",
  post_mortem: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

const EVENT_TYPES = [
  "detected", "reported", "escalated", "contained",
  "mitigated", "resolved", "post_mortem", "other",
];

export function IncidentTimelineTab({
  entries,
  onAddEntry,
  canEdit,
  labels,
}: IncidentTimelineTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("detected");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");

  const handleSubmit = () => {
    onAddEntry({
      eventType,
      description,
      occurredAt: occurredAt || undefined,
    });
    setShowForm(false);
    setDescription("");
    setOccurredAt("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {labels?.title ?? "Course of the Incident"}
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            + {labels?.addEntry ?? "Add Entry"}
          </button>
        )}
      </div>

      {/* Add Entry Form */}
      {showForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {labels?.eventType ?? "Event Type"}
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {labels?.description ?? "Description"}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {labels?.occurredAt ?? "Occurred At"}
              </label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!description.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                {labels?.save ?? "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {labels?.cancel ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative pl-6 space-y-6">
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />

        {entries.map((entry, idx) => (
          <div key={entry.id} className="relative">
            <div className={cn(
              "absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white",
              idx < entries.length - 1 ? "bg-teal-500" : "bg-gray-300",
            )} />
            <div className="pl-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400">
                  {new Date(entry.occurredAt).toLocaleString()}
                </span>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full uppercase",
                  EVENT_TYPE_COLORS[entry.eventType] ?? EVENT_TYPE_COLORS.other,
                )}>
                  {entry.eventType.replace(/_/g, " ")}
                </span>
                {entry.createdByName && (
                  <span className="text-xs text-gray-400">{entry.createdByName}</span>
                )}
              </div>
              <p className="text-sm text-gray-700">{entry.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
