"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RefreshButtonProps {
  generatedAt: string;
}

export default function RefreshButton({ generatedAt }: RefreshButtonProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const timeStr = new Date(generatedAt).toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1500);
  }

  return (
    <div className="refresh-row">
      <span className="refresh-time">עודכן ב-{timeStr}</span>
      <button
        className="refresh-btn"
        onClick={handleRefresh}
        aria-label="רענן נתונים"
        disabled={refreshing}
      >
        {refreshing ? "⏳" : "🔄"}
      </button>
    </div>
  );
}
