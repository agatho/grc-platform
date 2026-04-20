"use client";

import React, { useState } from "react";
import { cn } from "../../utils";

interface RACIEntry {
  activityId: string;
  activityName: string;
  participantId: string;
  participantName: string;
  role: "R" | "A" | "C" | "I";
  isOverride: boolean;
}

interface RACIMatrixTabProps {
  activities: { id: string; name: string }[];
  participants: { id: string; name: string }[];
  entries: RACIEntry[];
  onCellClick?: (
    activityId: string,
    participantId: string,
    currentRole: string | null,
  ) => void;
  onExport?: () => void;
  canEdit: boolean;
  labels?: {
    title: string;
    filter: string;
    export: string;
    activity: string;
  };
}

const ROLE_COLORS: Record<string, string> = {
  R: "bg-teal-100 text-teal-700 font-bold",
  A: "bg-blue-100 text-blue-700 font-bold",
  C: "bg-yellow-100 text-yellow-700",
  I: "bg-gray-100 text-gray-600",
};

export function RACIMatrixTab({
  activities,
  participants,
  entries,
  onCellClick,
  onExport,
  canEdit,
  labels,
}: RACIMatrixTabProps) {
  const [filterParticipant, setFilterParticipant] = useState<string>("");

  const filteredParticipants = filterParticipant
    ? participants.filter((p) => p.id === filterParticipant)
    : participants;

  const getEntry = (
    activityId: string,
    participantId: string,
  ): RACIEntry | undefined => {
    return entries.find(
      (e) => e.activityId === activityId && e.participantId === participantId,
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {labels?.title ?? "RACI Matrix"}
        </h3>
        <div className="flex items-center gap-3">
          <select
            value={filterParticipant}
            onChange={(e) => setFilterParticipant(e.target.value)}
            className="text-sm rounded-md border border-gray-300 px-2 py-1"
          >
            <option value="">{labels?.filter ?? "All Participants"}</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 rounded-md hover:bg-teal-100"
            >
              {labels?.export ?? "Export Excel"}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-4 py-2 text-left text-xs font-medium text-gray-500 border-b-2 border-teal-600">
                {labels?.activity ?? "Activity"}
              </th>
              {filteredParticipants.map((p) => (
                <th
                  key={p.id}
                  className="px-4 py-2 text-center text-xs font-medium text-gray-500 border-b-2 border-teal-600 whitespace-nowrap"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, idx) => (
              <tr
                key={activity.id}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="sticky left-0 bg-inherit px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                  {idx + 1}. {activity.name}
                </td>
                {filteredParticipants.map((participant) => {
                  const entry = getEntry(activity.id, participant.id);
                  return (
                    <td
                      key={participant.id}
                      className="px-4 py-2 text-center border-b border-gray-200"
                    >
                      {entry ? (
                        <button
                          type="button"
                          onClick={() =>
                            canEdit &&
                            onCellClick?.(
                              activity.id,
                              participant.id,
                              entry.role,
                            )
                          }
                          disabled={!canEdit}
                          className={cn(
                            "inline-flex items-center justify-center w-8 h-8 rounded-md text-sm relative",
                            ROLE_COLORS[entry.role],
                            canEdit && "cursor-pointer hover:opacity-80",
                          )}
                        >
                          {entry.role}
                          {entry.isOverride && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400" />
                          )}
                        </button>
                      ) : canEdit ? (
                        <button
                          type="button"
                          onClick={() =>
                            onCellClick?.(activity.id, participant.id, null)
                          }
                          className="w-8 h-8 rounded-md border border-dashed border-gray-300 hover:border-teal-400 transition-colors"
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
