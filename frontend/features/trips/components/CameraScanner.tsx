"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { useTranslations } from "next-intl";

interface DetectedCode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}
type DetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const SCAN_EVERY_MS = 300;
/** The same card is ignored for a moment so one hold in front of the camera scans once. */
const SAME_CODE_PAUSE_MS = 4000;

function detectorClass(): DetectorConstructor | null {
  return (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector ?? null;
}

/** Reads QR codes from the back camera with the browser's BarcodeDetector. Falls back to typing when unavailable. */
export function CameraScanner({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const t = useTranslations("crew.scan");
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<"unsupported" | "denied" | null>(null);
  const callback = useRef(onCode);
  callback.current = onCode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setProblem("unsupported");
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = { code: "", at: 0 };
    let stopped = false;
    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((media) => {
        if (stopped) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
        timer = setInterval(async () => {
          if (!video.current || pausedRef.current || video.current.readyState < 2) return;
          const [found] = await detector.detect(video.current).catch(() => []);
          if (!found) return;
          const now = Date.now();
          if (found.rawValue === last.code && now - last.at < SAME_CODE_PAUSE_MS) return;
          last = { code: found.rawValue, at: now };
          callback.current(found.rawValue);
        }, SCAN_EVERY_MS);
      })
      .catch(() => setProblem("denied"));
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (problem) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card bg-surface-alt p-6 text-center text-ink-muted">
        <CameraOff className="size-8" aria-hidden />
        <p>{t(problem === "denied" ? "cameraDenied" : "cameraUnsupported")}</p>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-card bg-black">
      <video ref={video} muted playsInline aria-label={t("camera")} className="aspect-square w-full object-cover" />
      <span aria-hidden className="pointer-events-none absolute inset-[18%] rounded-lg border-4 border-white/80" />
    </div>
  );
}
