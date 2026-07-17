"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, Controls, MarkerType, ReactFlow, useReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { create } from "zustand";
import { toPng } from "html-to-image";
import { applyOps, compactDiagram, emptyDiagram, publicDiagramOpsSchema, type Diagram, type DiagramOp } from "@/lib/diagram";
import { layoutDiagram, NODE_HEIGHT, nodeBoxWidth } from "@/lib/layout";
import { HandTracker, type HandDebug } from "@/components/hand-tracker";
import { WebSpeechTranscriptSource, type TranscriptHandlers, type TranscriptSource } from "@/lib/transcript-source";

type BoardStatus = "Idle" | "Listening" | "Thinking" | "Drawing";
type Session = { title?: unknown; subjectHint?: unknown; diagram: Diagram; opsLog: DiagramOp[][]; transcript: string };
type RedoEntry = { diagram: Diagram; ops: DiagramOp[] };
type RoomIconName = "mic" | "camera" | "share" | "replay" | "type" | "more";
type BoardStore = {
  diagram: Diagram;
  undoStack: Diagram[];
  redoStack: RedoEntry[];
  opsLog: DiagramOp[][];
  transcript: string;
  interim: string;
  status: BoardStatus;
  pointedNodeIds: string[];
  selectedNodeIds: string[];
  apply: (ops: DiagramOp[]) => Diagram;
  setPositions: (nodes: Diagram["nodes"]) => void;
  setPointed: (id: string | null) => void;
  toggleSelected: () => void;
  toggleSelectedNode: (id: string) => void;
  addFinal: (text: string) => void;
  setInterim: (text: string) => void;
  setStatus: (status: BoardStatus) => void;
  undo: () => void;
  redo: () => void;
  restore: (session: Pick<Session, "diagram" | "opsLog" | "transcript">) => void;
  reset: () => void;
};

const useBoard = create<BoardStore>((set, get) => ({
  diagram: emptyDiagram(), undoStack: [], redoStack: [], opsLog: [], transcript: "", interim: "", status: "Idle", pointedNodeIds: [], selectedNodeIds: [],
  apply: (ops) => {
    const next = applyOps(get().diagram, ops);
    set((state) => ({ undoStack: [...state.undoStack, structuredClone(state.diagram)], redoStack: [], opsLog: [...state.opsLog, ops], diagram: next, status: "Drawing" }));
    return next;
  },
  setPositions: (nodes) => set((state) => ({ diagram: { ...state.diagram, nodes } })),
  setPointed: (id) => set((state) => ((state.pointedNodeIds[0] ?? null) === id ? state : { pointedNodeIds: id ? [id] : [] })),
  toggleSelected: () => { const id = get().pointedNodeIds[0]; if (id) get().toggleSelectedNode(id); },
  toggleSelectedNode: (id) => set((state) => ({ pointedNodeIds: [id], selectedNodeIds: state.selectedNodeIds.includes(id) ? state.selectedNodeIds.filter((selected) => selected !== id) : [...state.selectedNodeIds, id].slice(-2) })),
  addFinal: (text) => set((state) => ({ transcript: `${state.transcript} ${text}`.trim(), interim: "" })),
  setInterim: (interim) => set({ interim }),
  setStatus: (status) => set({ status }),
  undo: () => set((state) => {
    const previous = state.undoStack.at(-1);
    const operations = state.opsLog.at(-1);
    return previous && operations ? { diagram: previous, undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, { diagram: structuredClone(state.diagram), ops: operations }], opsLog: state.opsLog.slice(0, -1), status: "Idle" } : state;
  }),
  redo: () => set((state) => {
    const next = state.redoStack.at(-1);
    return next ? { diagram: structuredClone(next.diagram), undoStack: [...state.undoStack, structuredClone(state.diagram)], redoStack: state.redoStack.slice(0, -1), opsLog: [...state.opsLog, next.ops], status: "Idle" } : state;
  }),
  restore: (session) => set({ diagram: session.diagram, undoStack: [], redoStack: [], opsLog: session.opsLog, transcript: session.transcript, interim: "", status: "Idle", pointedNodeIds: [], selectedNodeIds: [] }),
  reset: () => set({ diagram: emptyDiagram(), undoStack: [], redoStack: [], opsLog: [], transcript: "", interim: "", status: "Idle", pointedNodeIds: [], selectedNodeIds: [] }),
}));

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") (window as unknown as { __chalkBoard?: typeof useBoard }).__chalkBoard = useBoard;

const accent: Record<string, string> = { concept: "#e6a75b", actor: "#7ab8c4", process: "#b394d8", stage: "#77b78c", data: "#d7828b", example: "#d8b55e", note: "#c6c5bd" };
const WATER_CYCLE = ["The sun heats the ocean, causing evaporation.", "Water vapor rises and cools into clouds through condensation.", "Then precipitation falls from clouds back to the ocean, and the cycle repeats."];
const WORLD_WAR_I = ["World War One began in 1914 after the assassination of Archduke Franz Ferdinand.", "The alliance system drew Germany, Austria-Hungary, France, Britain, and Russia into the conflict.", "The war ended in 1918, followed by the Treaty of Versailles."];

function RoomIcon({ name }: { name: RoomIconName }) {
  const className = "size-5 fill-none stroke-current stroke-[1.8]";
  if (name === "mic") return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></svg>;
  if (name === "camera") return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg>;
  if (name === "share") return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><path d="M12 16V3m0 0L7 8m5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>;
  if (name === "replay") return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><path d="M4 11a8 8 0 1 1 2.3 5.7M4 4v7h7" /><path d="m10 9 5 3-5 3Z" /></svg>;
  if (name === "type") return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8.5 14h7" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>;
}

function RoundControl({ label, icon, active = false, disabled = false, onClick }: { label: string; icon: RoomIconName; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <div className="group relative"><button title={label} aria-label={label} type="button" onClick={onClick} disabled={disabled} className={`grid size-11 place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-[#e6a75b]/70 bg-[#e6a75b] text-[#172326] shadow-[0_0_20px_rgba(230,167,91,.3)]" : "border-white/12 bg-white/[.07] text-[#f5f0df] hover:border-white/25 hover:bg-white/[.13]"}`}><RoomIcon name={icon} /></button><span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0b1112] px-2 py-1 text-[11px] text-[#edf0ea] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{label}</span></div>;
}

function ViewportFitter({ signature, manualUntilRef }: { signature: string; manualUntilRef: React.RefObject<number> }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (Date.now() < manualUntilRef.current) return;
    const timer = window.setTimeout(() => void fitView({ padding: 0.22, duration: 500 }), 0);
    return () => window.clearTimeout(timer);
  }, [fitView, manualUntilRef, signature]);
  return null;
}

function GestureLayer({ areaRef, diagram, setPointed, toggleSelected, undo, onTrackerError, debugActiveRef, setDebug, handTrackingRequested, onHandTrackingChange, teacherName, onTeacherNameChange, status }: { areaRef: React.RefObject<HTMLElement | null>; diagram: Diagram; setPointed: (id: string | null) => void; toggleSelected: () => void; undo: () => void; onTrackerError: (message: string) => void; debugActiveRef: React.RefObject<boolean>; setDebug: (debug: HandDebug & { screen: { x: number; y: number }; flow: { x: number; y: number }; pointed: string | null }) => void; handTrackingRequested: boolean; onHandTrackingChange: (enabled: boolean) => void; teacherName: string; onTeacherNameChange: (name: string) => void; status: BoardStatus }) {
  const { getInternalNode, screenToFlowPosition, fitView } = useReactFlow();
  const cursorRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<{ id: string; since: number } | null>(null);
  const gesturePointedRef = useRef<string | null>(null);
  const trackingActiveRef = useRef(false);
  useEffect(() => { const fit = () => void fitView({ padding: 0.22, duration: 300 }); window.addEventListener("chalk:fit-view", fit); return () => window.removeEventListener("chalk:fit-view", fit); }, [fitView]);
  const releaseGesturePointed = useCallback(() => { const owned = gesturePointedRef.current; if (owned === null) return; gesturePointedRef.current = null; if ((useBoard.getState().pointedNodeIds[0] ?? null) === owned) setPointed(null); }, [setPointed]);
  const pointTo = useCallback((id: string) => { gesturePointedRef.current = id; if ((useBoard.getState().pointedNodeIds[0] ?? null) !== id) setPointed(id); }, [setPointed]);
  const onPoint = useCallback((point: { x: number; y: number }) => {
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const screen = { x: bounds.left + point.x * bounds.width, y: bounds.top + point.y * bounds.height };
    const flow = screenToFlowPosition(screen);
    if (cursorRef.current) { cursorRef.current.style.opacity = "1"; cursorRef.current.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`; }
    const node = diagram.nodes.find((candidate) => {
      const size = getInternalNode(candidate.id)?.measured;
      const width = size?.width || nodeBoxWidth(candidate);
      const height = size?.height || NODE_HEIGHT;
      return flow.x >= candidate.x && flow.x <= candidate.x + width && flow.y >= candidate.y && flow.y <= candidate.y + height;
    });
    const id = node?.id ?? null;
    const current = hoverRef.current;
    if (!id) { hoverRef.current = null; releaseGesturePointed(); return; }
    if (!current || current.id !== id) { hoverRef.current = { id, since: performance.now() }; return; }
    if (performance.now() - current.since >= 400) pointTo(id);
  }, [areaRef, diagram.nodes, getInternalNode, pointTo, releaseGesturePointed, screenToFlowPosition]);
  const clearGesturePointer = useCallback(() => { if (cursorRef.current) cursorRef.current.style.opacity = "0"; hoverRef.current = null; releaseGesturePointed(); }, [releaseGesturePointed]);
  const onTrackingChange = useCallback((enabled: boolean) => {
    onHandTrackingChange(enabled);
    if (enabled) { trackingActiveRef.current = true; return; }
    if (!trackingActiveRef.current) return;
    trackingActiveRef.current = false;
    clearGesturePointer();
  }, [clearGesturePointer, onHandTrackingChange]);
  const onDebug = useCallback((debug: HandDebug) => {
    if (!debugActiveRef.current) return;
    const bounds = areaRef.current?.getBoundingClientRect();
    const screen = bounds ? { x: bounds.left + debug.point.x * bounds.width, y: bounds.top + debug.point.y * bounds.height } : { x: 0, y: 0 };
    setDebug({ ...debug, screen, flow: screenToFlowPosition(screen), pointed: useBoard.getState().pointedNodeIds[0] ?? null });
  }, [areaRef, debugActiveRef, screenToFlowPosition, setDebug]);
  return <><div ref={cursorRef} className="pointer-events-none fixed z-30 size-4 rounded-full border-2 border-[#e6a75b] bg-[#e6a75b]/30 opacity-0 transition-opacity" /><HandTracker active={handTrackingRequested} teacherName={teacherName} onTeacherNameChange={onTeacherNameChange} status={status} onPoint={onPoint} onPinch={toggleSelected} onSwipeLeft={undo} onError={onTrackerError} onEnabledChange={onTrackingChange} onHandLost={clearGesturePointer} onDebug={onDebug} /></>;
}

function isSession(value: unknown): value is Session {
  return Boolean(value && typeof value === "object" && "diagram" in value && "opsLog" in value && "transcript" in value && typeof (value as Session).transcript === "string" && Array.isArray((value as Session).opsLog));
}

const formatElapsed = (totalSeconds: number) => `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;

export function ChalkBoard() {
  const { diagram, undoStack, redoStack, opsLog, transcript, interim, status, pointedNodeIds, selectedNodeIds, apply, setPositions, setPointed, toggleSelected, addFinal, setInterim, setStatus, undo, redo, restore, reset } = useBoard();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Untitled lesson");
  const [subjectHint, setSubjectHint] = useState("Water cycle");
  const [teacherName, setTeacherName] = useState("Teacher");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isExportingHandout, setIsExportingHandout] = useState(false);
  const [isReplay, setIsReplay] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [typedDrawerOpen, setTypedDrawerOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<"share" | "more" | null>(null);
  const [handTrackingRequested, setHandTrackingRequested] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [debug, setDebug] = useState<HandDebug & { screen: { x: number; y: number }; flow: { x: number; y: number }; pointed: string | null }>({ gesture: "Off", pinchDistance: 0, point: { x: 0, y: 0 }, fps: 0, screen: { x: 0, y: 0 }, flow: { x: 0, y: 0 }, pointed: null });
  const debugEnabledRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sourceRef = useRef<TranscriptSource | null>(null);
  const listeningRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const queuedRef = useRef("");
  const transcriptRef = useRef("");
  const subjectRef = useRef(subjectHint);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<() => void>(() => undefined);
  const canvasAreaRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualViewportUntilRef = useRef(0);

  useEffect(() => { debugEnabledRef.current = debugEnabled; }, [debugEnabled]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { subjectRef.current = subjectHint; }, [subjectHint]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [transcript, interim]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (sessionStartedAtRef.current !== null) setElapsedSeconds(Math.floor((Date.now() - sessionStartedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const beginSessionTimer = useCallback(() => {
    if (sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = Date.now();
      setElapsedSeconds(0);
    }
  }, []);
  const resetSessionTimer = useCallback(() => { sessionStartedAtRef.current = null; setElapsedSeconds(0); }, []);
  const handleDebug = useCallback((sample: HandDebug & { screen: { x: number; y: number }; flow: { x: number; y: number }; pointed: string | null }) => { if (debugEnabledRef.current) setDebug(sample); }, []);

  const isReplayRef = useRef(false);
  useEffect(() => { isReplayRef.current = isReplay; }, [isReplay]);
  const guardedUndo = useCallback(() => { if (!isReplayRef.current) undo(); }, [undo]);
  const guardedRedo = useCallback(() => { if (!isReplayRef.current) redo(); }, [redo]);
  const finishDrawing = useCallback(() => window.setTimeout(() => setStatus(listeningRef.current ? "Listening" : "Idle"), 450), [setStatus]);

  const send = useCallback(async () => {
    const delta = queuedRef.current.trim();
    if (!delta || requestRef.current || isReplay) return;
    queuedRef.current = "";
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("Thinking");
    try {
      const response = await fetch("/api/interpret", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptDelta: delta, recentTranscript: `${transcriptRef.current} ${delta}`.trim().slice(-1500), diagram: compactDiagram(useBoard.getState().diagram), pointerContext: { pointedNodeIds: useBoard.getState().pointedNodeIds, selectedNodeIds: useBoard.getState().selectedNodeIds }, subjectHint: subjectRef.current || undefined }),
      });
      const parsed = publicDiagramOpsSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) throw new Error("Chalk could not interpret that yet. Please try again.");
      const nextDiagram = apply(parsed.data.ops);
      setPositions(await layoutDiagram(nextDiagram));
      finishDrawing();
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(caught instanceof Error ? caught.message : "Try again.");
        setStatus(listeningRef.current ? "Listening" : "Idle");
      }
    } finally {
      requestRef.current = null;
      if (queuedRef.current.trim() && !controller.signal.aborted) sendRef.current();
    }
  }, [apply, finishDrawing, isReplay, setPositions, setStatus]);

  useEffect(() => { sendRef.current = () => void send(); }, [send]);
  const enqueueFinal = useCallback((value: string, sendImmediately: boolean) => {
    const clean = value.trim();
    if (!clean || isReplay) return;
    addFinal(clean);
    queuedRef.current = `${queuedRef.current} ${clean}`.trim();
    if (sendImmediately) void send();
  }, [addFinal, isReplay, send]);
  useEffect(() => { const interval = window.setInterval(() => { if (queuedRef.current.trim().length >= 80 && !requestRef.current) void send(); }, 4000); return () => window.clearInterval(interval); }, [send]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setIsListening(false);
    sourceRef.current?.stop();
    sourceRef.current = null;
    queuedRef.current = "";
    requestRef.current?.abort();
    requestRef.current = null;
    setInterim("");
    setTypedDrawerOpen(true);
    setStatus("Idle");
  }, [setInterim, setStatus]);
  const startListening = useCallback(() => {
    setError("");
    const source = new WebSpeechTranscriptSource();
    if (!source.supported) { setError("Speech recognition needs Chrome desktop. Typed input is ready below."); return; }
    beginSessionTimer();
    sourceRef.current = source;
    listeningRef.current = true;
    setIsListening(true);
    setTypedDrawerOpen(false);
    setStatus("Listening");
    const handlers: TranscriptHandlers = {
      onFinal: (finalText) => enqueueFinal(finalText, true),
      onInterim: setInterim,
      onError: (message) => { setError(message); stopListening(); },
      onEnd: () => { if (listeningRef.current) window.setTimeout(() => { if (listeningRef.current) source.start(handlers); }, 150); },
    };
    source.start(handlers);
  }, [beginSessionTimer, enqueueFinal, setInterim, setStatus, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z") { event.preventDefault(); if (event.shiftKey) guardedRedo(); else guardedUndo(); }
      else if (key === "y") { event.preventDefault(); guardedRedo(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guardedRedo, guardedUndo]);

  const submitTyped = useCallback(() => {
    if (!text.trim()) return;
    beginSessionTimer();
    enqueueFinal(text, true);
    setText("");
  }, [beginSessionTimer, enqueueFinal, text]);
  const downloadBlob = (name: string, blob: Blob) => { const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); };
  const download = (name: string, content: string, type: string) => downloadBlob(name, new Blob([content], { type }));
  const downloadDataUrl = async (name: string, dataUrl: string) => downloadBlob(name, await (await fetch(dataUrl)).blob());
  const exportJson = () => download("chalk-session.json", JSON.stringify({ title, subjectHint, diagram, opsLog, transcript }, null, 2), "application/json");
  const exportTranscript = () => download("chalk-transcript.txt", ["Chalk lesson transcript", `Title: ${title || "Untitled lesson"}`, `Subject: ${subjectHint || "Not specified"}`, "", transcript.trim()].join("\n"), "text/plain;charset=utf-8");
  const exportPng = async () => {
    const element = document.querySelector(".react-flow__renderer") as HTMLElement | null;
    if (!element) return;
    try { await downloadDataUrl("chalk-diagram.png", await toPng(element, { backgroundColor: "#111b1d", pixelRatio: 2, cacheBust: true })); }
    catch (caught) { console.error("PNG export failed", caught); setError("Chalk could not export the diagram image. Please try again."); }
  };
  const handout = async () => {
    setError("");
    setIsExportingHandout(true);
    setStatus("Thinking");
    try {
      const response = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, subjectHint, transcript, diagram: compactDiagram(diagram) }) });
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== "object" || !("markdown" in body) || typeof body.markdown !== "string") throw new Error();
      download("chalk-handout.md", body.markdown, "text/markdown");
    } catch { setError("Chalk could not create the handout yet. Please try again."); }
    finally { setIsExportingHandout(false); setStatus("Idle"); }
  };
  const restoreSession = useCallback((session: Session) => {
    restore({ diagram: session.diagram, opsLog: session.opsLog, transcript: session.transcript });
    if (typeof session.title === "string") setTitle(session.title);
    if (typeof session.subjectHint === "string") setSubjectHint(session.subjectHint);
  }, [restore]);
  useEffect(() => { const timer = window.setTimeout(() => { if (diagram.nodes.length || transcript) localStorage.setItem("chalk-session", JSON.stringify({ title, diagram, opsLog, transcript, subjectHint })); }, 500); return () => window.clearTimeout(timer); }, [diagram, opsLog, subjectHint, title, transcript]);
  useEffect(() => {
    const raw = localStorage.getItem("chalk-session");
    if (!raw || !window.confirm("Restore your previous Chalk session?")) return;
    const timer = window.setTimeout(() => {
      try { const session: unknown = JSON.parse(raw); if (!isSession(session)) throw new Error(); restoreSession(session); }
      catch { localStorage.removeItem("chalk-session"); setError("The saved Chalk session could not be restored."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [restoreSession]);
  useEffect(() => { if (!isPlaying) return; const timer = window.setTimeout(() => { if (replayIndex >= opsLog.length) setIsPlaying(false); else setReplayIndex((index) => index + 1); }, 700); return () => window.clearTimeout(timer); }, [isPlaying, opsLog.length, replayIndex]);

  const replayDiagram = useMemo(() => opsLog.slice(0, replayIndex).reduce((current, ops) => applyOps(current, ops), emptyDiagram()), [opsLog, replayIndex]);
  const [replayLaidOut, setReplayLaidOut] = useState<Diagram | null>(null);
  useEffect(() => {
    if (!isReplay) return;
    let cancelled = false;
    layoutDiagram(replayDiagram).then((laidOutNodes) => { if (!cancelled) setReplayLaidOut({ ...replayDiagram, nodes: laidOutNodes }); }).catch(() => { if (!cancelled) setReplayLaidOut(null); });
    return () => { cancelled = true; };
  }, [isReplay, replayDiagram]);
  const activeDiagram = isReplay ? (replayLaidOut ?? replayDiagram) : diagram;
  const exitReplay = () => { setIsPlaying(false); setIsReplay(false); setReplayLaidOut(null); };
  const enterReplay = () => { stopListening(); setReplayIndex(0); setIsPlaying(false); setReplayLaidOut(null); setIsReplay(true); };
  const clearBoard = () => { if (!window.confirm("Clear this board and remove its saved session?")) return; localStorage.removeItem("chalk-session"); resetSessionTimer(); reset(); exitReplay(); };
  const loadSession = async (file: File | undefined) => { if (!file) return; try { const session: unknown = JSON.parse(await file.text()); if (!isSession(session)) throw new Error(); restoreSession(session); exitReplay(); } catch { setError("That file is not a valid Chalk session."); } };
  const loadSample = async (lines: string[], subject: string) => { resetSessionTimer(); reset(); exitReplay(); setTitle(subject); setSubjectHint(subject); beginSessionTimer(); for (const line of lines) { enqueueFinal(line, true); await new Promise((resolve) => window.setTimeout(resolve, 750)); } };

  const nodes: Node[] = useMemo(() => activeDiagram.nodes.map((node) => {
    const pointed = pointedNodeIds.includes(node.id);
    const selected = selectedNodeIds.includes(node.id);
    const highlighted = activeDiagram.highlights.includes(node.id);
    const boxShadow = [pointed ? "0 0 0 4px #f3c887" : "", highlighted ? `0 0 20px ${accent[node.kind]}` : "", selected ? "inset 0 0 0 1px #fff8e7" : ""].filter(Boolean).join(", ") || "none";
    return {
      id: node.id,
      position: { x: node.x, y: node.y },
      data: { label: <div className="relative flex flex-col gap-1"><span className="text-xs">{{ concept: "◉", actor: "♙", process: "↻", stage: "◇", data: "▦", example: "✦", note: "✎" }[node.kind]}</span><strong className="pr-5">{node.label}</strong>{node.note && <small>{node.note}</small>}{selected && <span aria-label="Selected" className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-[#f5f0df] text-xs font-bold text-[#172326]">✓</span>}</div> },
      style: { border: `2px solid ${accent[node.kind]}`, borderRadius: 14, padding: "10px 14px", background: selected ? `${accent[node.kind]}55` : "#1d2d2e", color: "#f5f0df", boxShadow, transition: "transform 500ms ease, box-shadow 250ms ease, background-color 250ms ease" },
    };
  }), [activeDiagram, pointedNodeIds, selectedNodeIds]);
  const edges: Edge[] = useMemo(() => activeDiagram.edges.map((edge) => ({ ...edge, type: activeDiagram.layout === "cycle" || activeDiagram.layout === "radial" ? "default" : "smoothstep", markerEnd: edge.directed === false ? undefined : { type: MarkerType.ArrowClosed }, label: edge.label, style: { stroke: "#dce5df", strokeWidth: 1.8 }, labelStyle: { fill: "#fff8e7", fontSize: 12, fontWeight: 700 }, labelShowBg: true, labelBgStyle: { fill: "#142023", fillOpacity: 1 }, labelBgPadding: [7, 4], labelBgBorderRadius: 5 })), [activeDiagram]);
  const statusTone = status === "Listening" ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : status === "Thinking" || status === "Drawing" ? "border-[#e6a75b]/40 bg-[#e6a75b]/10 text-[#f3c887]" : "border-white/12 bg-white/[.04] text-[#aebbb5]";

  return <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0e1719] text-[#f5f0df]">
    <header className="z-30 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-[#142023]/95 px-5 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 text-[#f3c887]"><span className="grid size-8 place-items-center rounded-lg border border-[#e6a75b]/30 bg-[#e6a75b]/10 text-lg">✦</span><span className="text-sm font-semibold tracking-wide text-[#f5f0df]">Chalk</span></div>
      <div className="flex min-w-0 flex-1 items-center gap-2"><input aria-label="Lesson title" className="min-w-28 flex-1 border-b border-transparent bg-transparent px-1 py-1 text-sm font-medium outline-none transition focus:border-[#e6a75b]" value={title} onChange={(event) => setTitle(event.target.value)} /><span className="hidden h-4 w-px bg-white/15 sm:block" /><input aria-label="Subject hint" className="w-32 border-b border-transparent bg-transparent px-1 py-1 text-xs text-[#aebbb5] outline-none transition placeholder:text-[#6f827c] focus:border-[#e6a75b] sm:w-44" value={subjectHint} onChange={(event) => setSubjectHint(event.target.value)} placeholder="Subject" /></div>
      <time className="font-mono text-xs tabular-nums text-[#aebbb5]" aria-label="Elapsed session time">{formatElapsed(elapsedSeconds)}</time><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone}`}>{status}</span>
    </header>

    <div className="min-h-0 flex-1 p-3 pb-28 sm:p-5 sm:pb-28"><div className="grid h-full min-h-[calc(100vh-10rem)] grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-5">
      <section ref={canvasAreaRef} className="relative min-h-[540px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111b1d] shadow-2xl shadow-black/20">
        <div className="pointer-events-none absolute left-5 top-4 z-20 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#94a49e]"><span className="size-1.5 rounded-full bg-[#e6a75b]" />Live board</div>
        <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.22 }} onMoveStart={(event) => { if (event) manualViewportUntilRef.current = Date.now() + 4000; }} onNodeMouseEnter={(_, node) => setPointed(node.id)} onNodeMouseLeave={() => setPointed(null)} onNodeClick={() => toggleSelected()}>
          <ViewportFitter manualUntilRef={manualViewportUntilRef} signature={activeDiagram.nodes.map((node) => `${node.id}:${node.x}:${node.y}`).join("|")} />
          <GestureLayer areaRef={canvasAreaRef} diagram={activeDiagram} setPointed={setPointed} toggleSelected={toggleSelected} undo={guardedUndo} onTrackerError={setError} debugActiveRef={debugEnabledRef} setDebug={handleDebug} handTrackingRequested={handTrackingRequested} onHandTrackingChange={setHandTrackingRequested} teacherName={teacherName} onTeacherNameChange={setTeacherName} status={status} />
          <Background color="#36504b" gap={24} /><Controls className="chalk-flow-controls" />
        </ReactFlow>
        {isReplay && <div className="absolute left-5 right-[15rem] top-12 z-20 flex max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-[#101a1c]/90 px-3 py-2 text-xs shadow-lg backdrop-blur"><span className="whitespace-nowrap text-[#f3c887]">Replay {replayIndex}/{opsLog.length}</span><input aria-label="Replay progress" className="min-w-0 flex-1 accent-[#e6a75b]" type="range" min="0" max={opsLog.length} value={replayIndex} onChange={(event) => { setIsPlaying(false); setReplayIndex(Number(event.target.value)); }} /></div>}
        {debugEnabled && <pre className="absolute left-5 top-20 z-40 max-w-72 rounded-xl border border-white/10 bg-black/80 p-3 text-xs text-[#f5f0df]">{JSON.stringify({ gesture: debug.gesture, pinch: debug.pinchDistance.toFixed(3), video: debug.point, screen: debug.screen, flow: debug.flow, pointed: debug.pointed, selected: selectedNodeIds, fps: debug.fps.toFixed(1) }, null, 2)}</pre>}
        {nodes.length === 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center"><div className="max-w-md"><div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-[#e6a75b]/30 bg-[#e6a75b]/10 text-2xl text-[#f3c887]">✦</div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a7b5af]">Your live lesson room</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Press the mic and start teaching</h2><p className="mt-3 text-sm leading-6 text-[#a8b3ad]">Chalk will map your key ideas as you explain. Prefer typing? Choose Type instead from the toolbar.</p></div></div>}
      </section>
      <aside className="flex min-h-60 flex-col rounded-[1.5rem] border border-white/10 bg-[#142023] p-4 shadow-xl shadow-black/10 xl:min-h-0"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">Captions</p><p className="mt-0.5 text-xs text-[#80918b]">Final words and live interim text</p></div><span className={`size-2 rounded-full ${status === "Listening" ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.8)]" : status === "Thinking" || status === "Drawing" ? "animate-pulse bg-[#e6a75b]" : "bg-[#52635e]"}`} /></div><div ref={scrollRef} aria-live="polite" className="flex-1 overflow-auto rounded-2xl border border-white/[.08] bg-black/[.12] p-4 text-sm leading-7"><span className="text-[#e9ede8]">{transcript || "Your spoken lesson will appear here as clear, readable captions."}</span>{interim && <span className="text-[#71847d]"> {interim}</span>}</div></aside>
    </div></div>

    {typedDrawerOpen && <section className="absolute bottom-[5.4rem] left-1/2 z-40 w-[min(46rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#142023]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"><div className="mb-2 flex items-center justify-between"><label htmlFor="typed-input" className="text-sm font-medium">Type instead</label><button type="button" onClick={() => setTypedDrawerOpen(false)} className="rounded-md px-2 py-1 text-xs text-[#9cada7] transition hover:bg-white/10 hover:text-white" aria-label="Collapse typed input">Hide</button></div><div className="flex gap-2"><textarea id="typed-input" aria-label="Typed input" className="shell-input min-h-16 flex-1 resize-none" value={text} disabled={isReplay} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); submitTyped(); } }} placeholder="Type an explanation, then draw it…" /><button className="rounded-xl bg-[#e6a75b] px-4 py-2 text-sm font-semibold text-[#172326] transition hover:bg-[#f3c887] disabled:opacity-40" type="button" onClick={submitTyped} disabled={isReplay || !text.trim()}>Draw</button></div></section>}

    <div className="absolute bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[1.35rem] border border-white/15 bg-[#101a1c]/95 p-2 shadow-2xl shadow-black/45 backdrop-blur-xl">
      <RoundControl label={isListening ? "Stop listening" : "Start listening"} icon="mic" active={isListening || status === "Thinking" || status === "Drawing"} disabled={isReplay} onClick={isListening ? stopListening : startListening} />
      <RoundControl label={handTrackingRequested ? "Turn camera off" : "Enable hand tracking camera"} icon="camera" active={handTrackingRequested} onClick={() => setHandTrackingRequested((current) => !current)} />
      <RoundControl label="Type instead" icon="type" active={typedDrawerOpen} onClick={() => setTypedDrawerOpen((current) => !current)} />
      <div className="relative"><RoundControl label="Export" icon="share" active={openMenu === "share"} onClick={() => setOpenMenu((current) => current === "share" ? null : "share")} />{openMenu === "share" && <div className="absolute bottom-[calc(100%+14px)] left-1/2 w-52 -translate-x-1/2 rounded-xl border border-white/12 bg-[#142023] p-1.5 shadow-2xl"><button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); void exportPng(); }}>Export PNG</button><button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); exportJson(); }}>Save JSON</button><button className="room-menu-button" type="button" disabled={!transcript.trim()} onClick={() => { setOpenMenu(null); exportTranscript(); }}>Download transcript</button><button className="room-menu-button" type="button" disabled={!transcript || isExportingHandout} onClick={() => { setOpenMenu(null); void handout(); }}>{isExportingHandout ? "Preparing handout…" : "Download handout"}</button></div>}</div>
      <RoundControl label={isReplay ? "Exit replay" : "Replay lesson"} icon="replay" active={isReplay} disabled={!isReplay && !opsLog.length} onClick={isReplay ? exitReplay : enterReplay} />
      <div className="relative"><RoundControl label="More lesson controls" icon="more" active={openMenu === "more"} onClick={() => setOpenMenu((current) => current === "more" ? null : "more")} />{openMenu === "more" && <div className="absolute bottom-[calc(100%+14px)] right-0 w-56 rounded-xl border border-white/12 bg-[#142023] p-1.5 shadow-2xl"><button className="room-menu-button" type="button" disabled={!undoStack.length || isReplay} onClick={() => { setOpenMenu(null); guardedUndo(); }}>Undo</button><button className="room-menu-button" type="button" disabled={!redoStack.length || isReplay} onClick={() => { setOpenMenu(null); guardedRedo(); }}>Redo</button><button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); window.dispatchEvent(new Event("chalk:fit-view")); }}>Fit board to view</button><div className="my-1 border-t border-white/10" /><button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); void loadSample(WATER_CYCLE, "Water cycle"); }}>Load water-cycle sample</button><button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); void loadSample(WORLD_WAR_I, "World War I"); }}>Load WWI sample</button><button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); fileInputRef.current?.click(); }}>Load JSON</button>{process.env.NODE_ENV === "development" && <button className="room-menu-button" type="button" onClick={() => { setOpenMenu(null); setDebugEnabled((current) => !current); }}>{debugEnabled ? "Hide Debug HUD" : "Show Debug HUD"}</button>}<div className="my-1 border-t border-white/10" /><button className="room-menu-button text-[#e9a0a0] hover:bg-[#d7828b]/10" type="button" onClick={() => { setOpenMenu(null); clearBoard(); }}>Clear board</button></div>}</div>
    </div>
    <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={(event) => { void loadSession(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    {error && <p role="alert" className="absolute bottom-5 left-5 z-50 max-w-sm rounded-xl border border-[#d7828b]/30 bg-[#351f24]/95 px-3 py-2 text-sm text-[#f2b4b9] shadow-xl">{error}</p>}
  </main>;
}
