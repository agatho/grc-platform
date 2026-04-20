"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

interface BreachCountdownProps {
  deadline: string;
  className?: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function BreachCountdown({
  deadline,
  className = "",
}: BreachCountdownProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const deadlineMs = new Date(deadline).getTime();

    function update() {
      setRemaining(deadlineMs - Date.now());
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 24 * 60 * 60 * 1000;
  const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));

  const borderColor = isExpired
    ? "border-red-500 bg-red-50"
    : isUrgent
      ? "border-red-400 bg-red-50"
      : "border-yellow-400 bg-yellow-50";

  const textColor = isExpired || isUrgent ? "text-red-700" : "text-yellow-800";

  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 ${borderColor} ${className}`}
    >
      <div className="flex items-center gap-2">
        {isExpired ? (
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
        ) : (
          <Clock
            className={`h-5 w-5 shrink-0 ${isUrgent ? "text-red-600" : "text-yellow-600"}`}
          />
        )}
        <div>
          <p className={`text-sm font-semibold ${textColor}`}>
            72h GDPR Notification Deadline (Art. 33)
          </p>
          <p className={`text-lg font-mono font-bold ${textColor}`}>
            {isExpired ? (
              "DEADLINE EXPIRED"
            ) : (
              <>
                {formatTimeRemaining(remaining)}
                <span className="text-sm font-normal ml-2">
                  ({hours}h remaining)
                </span>
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Deadline: {new Date(deadline).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
