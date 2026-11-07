"use client";

import { Camera, CameraOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type JsQr from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

/** Frames read per second: enough for a quick scan, light on an old phone's battery. */
const SCANS_PER_SECOND = 6;
/** The same code seen again within this time is the same pass still in front of the camera. */
const SAME_CODE_MS = 4000;
/** Frames are shrunk to this width before decoding: faster, and passes still read fine. */
const DECODE_WIDTH = 480;

const CameraState = {
  Off: "off",
  Starting: "starting",
  On: "on",
  Denied: "denied",
  Unavailable: "unavailable",
} as const;
type CameraState = (typeof CameraState)[keyof typeof CameraState];

interface QrScannerProps {
  /** Stop reading codes (a scan is being sent, or a dialog is open). The camera stays on. */
  paused: boolean;
  onCode: (text: string) => void;
}

/**
 * The phone's back camera reading the student's pass. Works in any modern browser over HTTPS
 * (or localhost); the decoder loads only when the camera is turned on.
 */
export function QrScanner({ paused, onCode }: QrScannerProps) {
  const t = useTranslations("crew.scan.camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const [state, setState] = useState<CameraState>(CameraState.Off);

  useEffect(() => {
    pausedRef.current = paused;
    onCodeRef.current = onCode;
  });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState(CameraState.Unavailable);
      return;
    }
    setState(CameraState.Starting);
    try {
      const [stream, { default: jsQR }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        }),
        import("jsqr"),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      setState(CameraState.On);
      readFrames(video, jsQR);
    } catch (error) {
      stop();
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setState(denied ? CameraState.Denied : CameraState.Unavailable);
    }
  }

  function readFrames(video: HTMLVideoElement, decode: typeof JsQr) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (!streamRef.current) return;
      if (context && !pausedRef.current && video.videoWidth > 0) {
        const scale = Math.min(1, DECODE_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = decode(image.data, image.width, image.height, {
          inversionAttempts: "dontInvert",
        });
        const now = Date.now();
        const last = lastRef.current;
        if (code?.data && !(last && last.text === code.data && now - last.at < SAME_CODE_MS)) {
          lastRef.current = { text: code.data, at: now };
          onCodeRef.current(code.data);
        }
      }
      window.setTimeout(tick, 1000 / SCANS_PER_SECOND);
    };
    tick();
  }

  const isOn = state === CameraState.On;
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "relative aspect-square w-full max-w-sm self-center overflow-hidden rounded-card bg-ink-strong",
          !isOn && "hidden",
        )}
      >
        <video ref={videoRef} muted playsInline className="size-full object-cover" />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-[15%] rounded-card border-4",
            paused ? "border-white/40" : "border-white",
          )}
        />
      </div>
      {isOn ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-center"
          iconStart={<CameraOff className="size-4" />}
          onClick={() => {
            stop();
            setState(CameraState.Off);
          }}
        >
          {t("turnOff")}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-8 text-center">
          {state === CameraState.Starting ? (
            <Spinner />
          ) : (
            <Camera aria-hidden="true" className="size-8 text-teal" />
          )}
          <p className="text-body-sm text-ink">
            {state === CameraState.Denied ? t("denied") : null}
            {state === CameraState.Unavailable ? t("unavailable") : null}
            {state === CameraState.Off || state === CameraState.Starting ? t("lead") : null}
          </p>
          <Button
            size="lg"
            disabled={state === CameraState.Starting}
            iconStart={<Camera className="size-5" />}
            onClick={() => void start()}
          >
            {t("turnOn")}
          </Button>
        </div>
      )}
    </div>
  );
}
