"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Clock } from "lucide-react";
import { TimelineCard } from "./TimelineCard";
import { useInvestigation } from "@/contexts/InvestigationContext";

export function TimelineColumn() {
  const { invState, scenario, reorderTimeline, getEvidence } = useInvestigation();
  const { timeline } = invState;

  // Register this column as a dnd-kit drop target so evidence cards can be
  // dropped here from the evidence workspace.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: "timeline-drop-zone" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = timeline.findIndex((s) => s.slotId === active.id);
    const newIndex = timeline.findIndex((s) => s.slotId === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderTimeline(arrayMove(timeline, oldIndex, newIndex));
    }
  }, [timeline, reorderTimeline]);

  return (
    <div ref={setDropRef} className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white/80">Attack Timeline</h3>
          {timeline.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
              {timeline.length}
            </span>
          )}
        </div>
        {timeline.length > 0 && (
          <span className="text-[9px] font-mono text-white/20">Drag to reorder</span>
        )}
      </div>

      {/* Drop zone hint (empty) */}
      {timeline.length === 0 && (
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center min-h-[200px] transition-colors duration-150 ${
          isOver ? "border-purple-500/40 bg-purple-500/[0.05]" : "border-white/[0.05]"
        }`}>
          <Clock className={`w-6 h-6 transition-colors duration-150 ${isOver ? "text-purple-400/50" : "text-white/15"}`} />
          <div>
            <p className="text-xs text-white/25 font-mono mb-1">Timeline is empty</p>
            <p className="text-[10px] text-white/15">
              Drag evidence cards here or click<br />"Add to Timeline"
            </p>
          </div>
        </div>
      )}

      {/* Sortable timeline */}
      {timeline.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={timeline.map((s) => s.slotId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col">
                {timeline.map((slot, i) => {
                  const evidence = getEvidence(slot.evidenceId);
                  if (!evidence) return null;
                  return (
                    <TimelineCard
                      key={slot.slotId}
                      slotId={slot.slotId}
                      evidence={evidence}
                      index={i}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Scenario objective summary */}
      {scenario && timeline.length > 0 && (
        <div className="flex-shrink-0 p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
          <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest mb-1.5">Coverage</p>
          <div className="flex flex-wrap gap-1">
            {scenario.mitreCategories.map((cat) => {
              const covered = timeline.some((slot) => {
                const ev = getEvidence(slot.evidenceId);
                return ev?.mitreTactic.toLowerCase().includes(cat.toLowerCase());
              });
              return (
                <span
                  key={cat}
                  className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
                    covered
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-white/[0.02] text-white/20 border-white/[0.05]"
                  }`}
                >
                  {cat}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
