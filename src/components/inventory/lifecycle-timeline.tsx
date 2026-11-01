import * as React from "react";
import { formatDate } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  date: Date | string;
  title: string;
  description: string;
  icon: string;
  dotColor: string;
  metadata?: string;
}

interface LifecycleTimelineProps {
  events: TimelineEvent[];
}

export function LifecycleTimeline({ events }: LifecycleTimelineProps) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="bg-[#FFFFFF] border border-border rounded p-6 select-none">
      <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-[#3B0A0F] uppercase tracking-wider">
            Complete Asset Lifecycle Trail
          </h3>

        </div>
        <span className="text-xs font-mono font-bold border px-2 py-0.5 rounded badge-solid badge-maroon">
          {events.length} Recorded Milestones
        </span>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#6E2B32]">
          No lifecycle milestones recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-sand">
          {sortedEvents.map((evt) => (
            <div key={evt.id} className="relative flex items-start gap-3">
              {/* Dot */}
              <span
                className={`absolute -left-[19px] top-1 w-4 h-4 rounded-full border-2 border-[#FFFFFF] ${evt.dotColor} shrink-0`}
              />

              <div className="w-full bg-cream border border-border p-3.5 rounded text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#3B0A0F] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#A60212] text-[16px]">
                      {evt.icon}
                    </span>
                    <span>{evt.title}</span>
                  </h4>
                  <span className="text-[11px] text-[#6E2B32] font-mono">
                    {formatDate(evt.date)}
                  </span>
                </div>

                <p className="text-xs text-[#3B0A0F] mt-1 leading-relaxed">
                  {evt.description}
                </p>

                {evt.metadata && (
                  <div className="mt-2 pt-2 border-t border-border text-[11px] text-[#6E2B32] font-mono">
                    {evt.metadata}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
