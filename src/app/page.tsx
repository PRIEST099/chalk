export default function Home() {
  return (
    <main className="min-h-screen bg-[#111b1d] text-[#f5f0df]">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-[#172326] px-5 py-4">
        <div className="mr-4 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-[#e6a75b] text-xl text-[#172326]">✦</span>
          <div><h1 className="font-semibold tracking-wide">Chalk</h1><p className="text-xs text-[#a8b3ad]">The board that draws itself</p></div>
        </div>
        <input aria-label="Session title" className="shell-input min-w-44 flex-1" defaultValue="Untitled lesson" />
        <input aria-label="Subject hint" className="shell-input w-52" placeholder="Subject hint (optional)" />
        <span className="rounded-full border border-[#e6a75b]/40 bg-[#e6a75b]/10 px-3 py-1 text-sm text-[#f3c887]">Idle</span>
      </header>
      <div className="grid min-h-[calc(100vh-137px)] grid-cols-1 lg:grid-cols-[1fr_320px]">
        <section className="relative grid min-h-[520px] place-items-center overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_center,_#263a38_0,_#111b1d_68%)] lg:border-b-0 lg:border-r">
          <div className="text-center"><p className="mb-3 text-5xl text-[#e6a75b]/80">✦</p><h2 className="text-xl font-medium">Your lesson will take shape here</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#a8b3ad]">Start speaking, type an explanation, or load a sample to build a living concept diagram.</p></div>
          <span className="absolute bottom-5 left-5 rounded bg-black/20 px-3 py-1.5 text-xs text-[#a8b3ad]">Canvas · ready</span>
        </section>
        <aside className="flex min-h-72 flex-col bg-[#142023] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-medium">Live transcript</h2><span className="text-xs text-[#7e9089]">Waiting</span></div><div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 px-6 text-center text-sm leading-6 text-[#8f9d98]">Your final and in-progress words will appear here.</div></aside>
      </div>
      <nav aria-label="Lesson controls" className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#172326] px-5 py-3">
        {['Start listening', 'Typed input', 'Undo', 'Replay', 'Export', 'Load sample'].map((label) => <button className="control-button" key={label} type="button">{label}</button>)}
      </nav>
    </main>
  );
}
