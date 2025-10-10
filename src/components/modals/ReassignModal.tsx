"use client";
import React, { useState } from "react";
import { BaseModal } from "./BaseModal";

interface ReassignModalProps {
  open: boolean;
  onClose: () => void;
  schedule: any;
  studioLocations: any[];
  onReassign: (scheduleId: number, newStudioId: number) => Promise<void>;
}

export const ReassignModal = ({
  open,
  onClose,
  schedule,
  studioLocations,
  onReassign
}: ReassignModalProps) => {
  const [selected, setSelected] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  if (!open || !schedule) return null;

  const curStudio = studioLocations.find((s) => s.id === schedule.sub_location_id);
  const selStudio = studioLocations.find((s) => s.id === selected);

  const handle = async () => {
    if (selected === 0 || selected === schedule.sub_location_id) return;

    const compatible = selStudio?.shooting_types?.includes(
      schedule.shooting_type
    );
    if (!compatible) {
      if (!confirm("비호환 스튜디오입니다. 계속하시겠습니까?")) return;
    }

    setLoading(true);
    await onReassign(schedule.id, selected);
    setLoading(false);
    setSelected(0);
    onClose();
  };

  return (
    <BaseModal open={open} onClose={onClose} title="스튜디오 재배정">
      <p style={{ marginBottom: 12 }}>
        현재 스튜디오: <strong>{curStudio?.name}번</strong>
      </p>

      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        style={{ width: "100%", padding: 10, marginBottom: 18 }}
      >
        <option value={0}>새 스튜디오 선택</option>
        {studioLocations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}번
            {s.shooting_types?.includes(schedule.shooting_type)
              ? " (호환)"
              : " (비호환)"}
          </option>
        ))}
      </select>

      {selected > 0 && (
        <div
          style={{
            background: selStudio?.shooting_types?.includes(
              schedule.shooting_type
            )
              ? "#dcfce7"
              : "#fee2e2",
            padding: 12,
            borderRadius: 6,
            marginBottom: 18
          }}
        >
          {selStudio?.shooting_types?.includes(schedule.shooting_type)
            ? "호환 스튜디오입니다."
            : "비호환 스튜디오이므로 주의하세요."}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handle}
          disabled={selected === 0 || loading}
          style={{
            flex: 1,
            background: loading || selected === 0 ? "#e2e8f0" : "#06b6d4",
            color: loading || selected === 0 ? "#94a3b8" : "#fff",
            padding: 12,
            border: "none",
            borderRadius: 6
          }}
        >
          {loading ? "재배정 중…" : "재배정"}
        </button>
        <button onClick={onClose} style={{ flex: 1 }}>
          취소
        </button>
      </div>
    </BaseModal>
  );
};
