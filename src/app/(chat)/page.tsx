/** Landing state for `/`: sidebar is shown, no conversation selected. */
export default function ChatIndexPage() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
      <p className="text-sm text-slate-500">
        Select a conversation, or start a new one.
      </p>
    </div>
  );
}
