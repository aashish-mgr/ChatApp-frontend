/** Placeholder bars used while rooms or messages load. */
export function RoomListSkeleton() {
  return (
    <ul className="flex-1 space-y-1 overflow-hidden p-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-2 py-2">
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-800" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 animate-pulse rounded bg-slate-800" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-800/70" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MessagePaneSkeleton() {
  const lines = ["w-2/5", "w-3/5", "w-1/3", "w-1/2", "w-2/3"];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-800" />
        <span className="space-y-2">
          <span className="block h-3 w-28 animate-pulse rounded bg-slate-800" />
          <span className="block h-3 w-16 animate-pulse rounded bg-slate-800/70" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-4">
        {lines.map((width, index) => (
          <span
            key={index}
            className={`h-8 animate-pulse rounded-2xl bg-slate-800 ${
              index % 2 === 0 ? "self-start" : "self-end"
            } ${width}`}
          />
        ))}
      </div>
    </div>
  );
}
