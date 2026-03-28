"use client";

import React, { useRef, useEffect } from "react";

interface MetroStation {
  processId: string;
  processName: string;
  health: string;
  x: number;
  y: number;
  lineColor: string;
  connections: string[];
}

interface MetroLine {
  id: string;
  name: string;
  color: string;
  stationIds: string[];
}

interface MetroCardMapProps {
  stations: MetroStation[];
  lines: MetroLine[];
  onStationClick?: (processId: string) => void;
  width?: number;
  height?: number;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
};

export function MetroCardMap({
  stations,
  lines,
  onStationClick,
  width = 1200,
  height = 600,
}: MetroCardMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const stationMap = new Map(stations.map((s) => [s.processId, s]));

  return (
    <div className="overflow-auto border border-gray-200 rounded-lg bg-white">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-full"
        style={{ minHeight: 400 }}
      >
        {/* Draw lines */}
        {lines.map((line) => {
          const lineStations = line.stationIds
            .map((id) => stationMap.get(id))
            .filter(Boolean) as MetroStation[];

          if (lineStations.length < 2) return null;

          const pathData = lineStations
            .map((s, idx) => `${idx === 0 ? "M" : "L"} ${s.x} ${s.y}`)
            .join(" ");

          return (
            <path
              key={line.id}
              d={pathData}
              stroke={line.color}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
          );
        })}

        {/* Draw stations */}
        {stations.map((station) => (
          <g
            key={station.processId}
            onClick={() => onStationClick?.(station.processId)}
            style={{ cursor: "pointer" }}
          >
            {/* Outer ring */}
            <circle
              cx={station.x}
              cy={station.y}
              r={14}
              fill="white"
              stroke={station.lineColor}
              strokeWidth={3}
            />
            {/* Health indicator */}
            <circle
              cx={station.x}
              cy={station.y}
              r={6}
              fill={HEALTH_COLORS[station.health] ?? "#9ca3af"}
            />
            {/* Label */}
            <text
              x={station.x}
              y={station.y + 28}
              textAnchor="middle"
              className="text-xs fill-gray-700"
              fontFamily="system-ui"
              fontSize={11}
            >
              {station.processName.length > 20
                ? station.processName.substring(0, 18) + "..."
                : station.processName}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
