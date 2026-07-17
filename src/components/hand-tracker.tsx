"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandDebug = { gesture: string; pinchDistance: number; point: { x: number; y: number }; fps: number };
type Props = { onPoint: (point: { x: number; y: number }) => void; onPinch: () => void; onSwipeLeft: () => void; onError: (message: string) => void; onDebug: (debug: HandDebug) => void };
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const distance = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

export function HandTracker({ onPoint, onPinch, onSwipeLeft, onError, onDebug }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const landmarkerRef = useRef<HandLandmarker | null>(null); const frameRef = useRef<number | null>(null); const streamRef = useRef<MediaStream | null>(null); const lastFrameRef = useRef(0); const fpsRef = useRef({ at: 0, frames: 0, value: 0 }); const smoothRef = useRef<{ x: number; y: number } | null>(null); const pinchActiveRef = useRef(false); const pinchCooldownRef = useRef(0); const swipeCooldownRef = useRef(0); const wristRef = useRef<{ x: number; at: number } | null>(null); const processRef = useRef<(now: number) => void>(() => undefined); const [enabled, setEnabled] = useState(false);
  const stop = useCallback(() => { if (frameRef.current) cancelAnimationFrame(frameRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; landmarkerRef.current?.close(); landmarkerRef.current = null; setEnabled(false); }, []);
  const process = useCallback((now: number) => {
    const video = videoRef.current; const canvas = canvasRef.current; const landmarker = landmarkerRef.current; if (!video || !canvas || !landmarker) return;
    if (now - lastFrameRef.current < 33) { frameRef.current = requestAnimationFrame((time) => processRef.current(time)); return; } lastFrameRef.current = now;
    const result = landmarker.detectForVideo(video, now); const hand = result.landmarks[0]; const fps = fpsRef.current; fps.frames += 1; if (now - fps.at > 1000) { fps.value = (fps.frames * 1000) / Math.max(now - fps.at, 1); fps.frames = 0; fps.at = now; }
    const context = canvas.getContext("2d"); if (context) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.clearRect(0, 0, canvas.width, canvas.height); if (hand) { context.fillStyle = "#f5f0df"; for (const landmark of hand) { context.beginPath(); context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, Math.PI * 2); context.fill(); } } }
    if (hand) { const handSize = Math.max(distance(hand[0], hand[9]), 0.01); const pinchDistance = distance(hand[4], hand[8]) / handSize; const indexExtended = distance(hand[8], hand[0]) > distance(hand[6], hand[0]) * 1.12; const openPalm = [8, 12, 16, 20].every((tip, index) => distance(hand[tip], hand[0]) > distance(hand[[6, 10, 14, 18][index]], hand[0]) * 1.1); const raw = { x: 1 - hand[8].x, y: hand[8].y }; const previous = smoothRef.current; const smooth = previous ? { x: previous.x * 0.72 + raw.x * 0.28, y: previous.y * 0.72 + raw.y * 0.28 } : raw; smoothRef.current = smooth;
      if (indexExtended) onPoint(smooth);
      if (!pinchActiveRef.current && pinchDistance < 0.32 && now - pinchCooldownRef.current > 650) { pinchActiveRef.current = true; pinchCooldownRef.current = now; onPinch(); }
      if (pinchActiveRef.current && pinchDistance > 0.44) pinchActiveRef.current = false;
      const previousWrist = wristRef.current; const velocity = previousWrist ? (previousWrist.x - hand[0].x) / Math.max((now - previousWrist.at) / 1000, 0.001) : 0; if (openPalm && velocity < -1.1 && now - swipeCooldownRef.current > 900) { swipeCooldownRef.current = now; onSwipeLeft(); } wristRef.current = { x: hand[0].x, at: now };
      onDebug({ gesture: pinchActiveRef.current ? "Pinch" : openPalm ? "Open palm" : indexExtended ? "Point" : "Tracking", pinchDistance, point: smooth, fps: fps.value });
    } else onDebug({ gesture: "No hand", pinchDistance: 0, point: smoothRef.current ?? { x: 0, y: 0 }, fps: fps.value });
    frameRef.current = requestAnimationFrame((time) => processRef.current(time));
  }, [onDebug, onPinch, onPoint, onSwipeLeft]);
  useEffect(() => { processRef.current = process; }, [process]);
  const enable = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); streamRef.current = stream; const video = videoRef.current; if (!video) return; video.srcObject = stream; await video.play(); const vision = await FilesetResolver.forVisionTasks(WASM_URL); landmarkerRef.current = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL }, runningMode: "VIDEO", numHands: 1 }); fpsRef.current.at = performance.now(); setEnabled(true); frameRef.current = requestAnimationFrame(process); } catch { stop(); onError("Camera access was denied or unavailable. Mouse controls are ready instead."); } };
  useEffect(() => stop, [stop]);
  return <div className="absolute bottom-4 right-4 z-20 w-[200px] overflow-hidden rounded-xl border border-white/20 bg-black/60 shadow-xl"><div className="relative aspect-video w-full -scale-x-100"><video ref={videoRef} muted playsInline className="h-full w-full object-cover" /><canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" /></div>{!enabled && <button className="absolute inset-0 bg-[#142023]/90 text-sm font-medium text-[#f5f0df]" type="button" onClick={() => void enable()}>Enable hand tracking</button>}<button className="absolute right-1 top-1 rounded bg-black/50 px-1.5 text-xs" type="button" onClick={stop} aria-label="Disable hand tracking">×</button></div>;
}
