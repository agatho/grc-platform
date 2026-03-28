"use client";

import React from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

interface EmergencyOfficerFieldProps {
  selectedUserId: string | null;
  users: User[];
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export function EmergencyOfficerField({
  selectedUserId,
  users,
  onChange,
  disabled = false,
  label,
}: EmergencyOfficerFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label ?? "Emergency Officer"}
      </label>
      <select
        value={selectedUserId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
      >
        <option value="">-- Select --</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.email})
          </option>
        ))}
      </select>
    </div>
  );
}
