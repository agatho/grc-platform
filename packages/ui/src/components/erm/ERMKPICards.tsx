"use client";

import React from "react";

interface KPIData {
  risksInEvaluation: number;
  processRisks: number;
  measuresInProgress: number;
  overdueMeasures: number;
}

interface ERMKPICardsProps {
  data: KPIData;
  labels?: {
    risksInEvaluation: string;
    processRisks: string;
    measuresInProgress: string;
    overdueMeasures: string;
  };
}

export function ERMKPICards({ data, labels }: ERMKPICardsProps) {
  const cards = [
    {
      value: data.risksInEvaluation,
      label: labels?.risksInEvaluation ?? "Risks in Evaluation",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
    {
      value: data.processRisks,
      label: labels?.processRisks ?? "Process Risks",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      value: data.measuresInProgress,
      label: labels?.measuresInProgress ?? "Measures in Progress",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      value: data.overdueMeasures,
      label: labels?.overdueMeasures ?? "Overdue Measures",
      color: data.overdueMeasures > 0 ? "text-red-600" : "text-green-600",
      bgColor: data.overdueMeasures > 0 ? "bg-red-50" : "bg-green-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bgColor} rounded-lg p-4 text-center`}
        >
          <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
          <div className="text-xs text-gray-600 mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
