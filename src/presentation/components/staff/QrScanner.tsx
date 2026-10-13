import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/presentation/components/ui";

/** Camera lifecycle states the scanner can be in. */
export type QrScannerStatus =
  | "starting"
  | "running"
  | "denied"
  | "no-camera"
  | "unsupported"
  | "error";

export interface QrScannerProps {
  /** Called at most once per `scanKey` with the decoded credential. */
  onDecoded: (value: string) => void;
  /** When `false` the camera stream is stopped (e.g. while a result is shown). */
  active: boolean;
  /**
   * Bumped by the parent to arm the next scan: the component then decodes
   * once more even though `active` stayed `true`.
   */
  scanKey: number;
}

/** Minimal shape of the native `BarcodeDetector` result we consume. */
interface DetectedBarcode {
  rawValue: string;
}

/** Minimal shape of the native `BarcodeDetector` instance we consume. */
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

function getNativeBarcodeDetector(): BarcodeDetectorConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

function classifyCameraError(error: unknown): QrScannerStatus {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-camera";
  return "error";
}

/**
 * Browser camera QR scanner.
 *
 * DECODING, in priority order:
 * 1. the native `BarcodeDetector` when the browser exposes it (Chromium on
 *    desktop/Android) — zero bytes of decoder shipped;
 * 2. otherwise `jsqr`, loaded with a DYNAMIC import so the library never enters
 *    the entry chunk (it lives in a chunk that only a scan page visit fetches).
 *
 * The stream is always released on unmount and whenever `active` flips to
 * `false` or a decode succeeds, so the camera indicator never stays on. Every
 * camera failure renders a spoken status instead of a dead black rectangle.
 */
export function QrScanner({ onDecoded, active, scanKey }: QrScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const [status, setStatus] = useState<QrScannerStatus>("starting");
  const [attempt, setAttempt] = useState(0);

  // Keep the latest callback in a ref so a parent re-render never restarts the
  // camera (the effect below depends only on `active`/`scanKey`/`attempt`).
  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let handled = false;
    let frame = 0;

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };

    // Decoders are created ONCE per scan session, not per frame: the jsQR
    // module is imported lazily the first time a frame is decoded (and never
    // when the browser ships a native `BarcodeDetector`).
    const NativeDetector = getNativeBarcodeDetector();
    let detector: BarcodeDetectorInstance | null = null;
    let jsQrDecode:
      | ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null)
      | null = null;
    const canvas = document.createElement("canvas");

    const decodeOnce = async (video: HTMLVideoElement): Promise<string | null> => {
      if (NativeDetector) {
        detector ??= new NativeDetector({ formats: ["qr_code"] });
        const results = await detector.detect(video);
        const value = results[0]?.rawValue;
        return typeof value === "string" && value !== "" ? value : null;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width === 0 || height === 0) return null;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(video, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      if (jsQrDecode === null) {
        const module = await import("jsqr");
        jsQrDecode = module.default;
      }
      return jsQrDecode(image.data, image.width, image.height)?.data ?? null;
    };

    const loop = async (video: HTMLVideoElement) => {
      if (cancelled || handled) return;
      try {
        const value = await decodeOnce(video);
        if (!cancelled && value !== null) {
          handled = true;
          onDecodedRef.current(value);
          return;
        }
      } catch {
        // A frame that fails to decode is normal while the camera focuses;
        // keep scanning on the next frame.
      }
      if (!cancelled && !handled) {
        frame = window.requestAnimationFrame(() => {
          void loop(video);
        });
      }
    };

    const start = async () => {
      setStatus("starting");

      if (
        typeof navigator === "undefined" ||
        navigator.mediaDevices === undefined ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setStatus("unsupported");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Autoplay policies may reject `play()`; the stream is still live and
          // the browser will start it on the next painted frame.
        }
        if (cancelled) return;
        setStatus("running");
        void loop(video);
      } catch (error) {
        if (!cancelled) setStatus(classifyCameraError(error));
      }
    };

    void start();

    return () => {
      cancelled = true;
      handled = true;
      if (frame !== 0) window.cancelAnimationFrame(frame);
      stopStream();
    };
  }, [active, scanKey, attempt]);

  const statusMessageKey: Record<QrScannerStatus, string> = {
    starting: "staff.scan.starting",
    running: "staff.scan.hint",
    denied: "staff.scan.permission_denied",
    "no-camera": "staff.scan.no_camera",
    unsupported: "staff.scan.unsupported",
    error: "staff.scan.camera_error",
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        aria-live="polite"
        aria-label={t("staff.scan.status_region")}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label={t("staff.scan.video_label")}
            className={status === "running" ? "h-64 w-full object-cover" : "hidden"}
          />
          {status === "running" ? null : (
            <div className="flex h-64 w-full items-center justify-center px-6 text-center">
              <p className="text-sm text-white">{t(statusMessageKey[status])}</p>
            </div>
          )}
        </div>

        {status === "denied" || status === "error" || status === "no-camera" ? (
          <Button variant="outline" onClick={retry}>
            {t("staff.scan.retry_camera")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
