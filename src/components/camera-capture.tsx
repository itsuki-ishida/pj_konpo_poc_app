"use client"

import * as React from "react"
import Webcam from "react-webcam"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, Check, X, Loader2, SwitchCamera } from "lucide-react"

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const webcamRef = React.useRef<Webcam>(null)
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">(
    "environment"
  )
  const [hasMultipleCameras, setHasMultipleCameras] = React.useState(false)

  React.useEffect(() => {
    // Check for multiple cameras
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === "videoinput")
      setHasMultipleCameras(videoDevices.length > 1)
    })
  }, [])

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode,
  }

  const handleCapture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCapturedImage(imageSrc)
      }
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
  }

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage)
    }
  }

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  return (
    <div className="relative">
      {/* Camera view or captured image */}
      <div className="relative aspect-[4/3] bg-black">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMedia={() => setIsLoading(false)}
              onUserMediaError={() => setIsLoading(false)}
              className="w-full h-full object-contain"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 flex items-center justify-center gap-4">
        {capturedImage ? (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              撮り直す
            </Button>
            <Button size="lg" onClick={handleConfirm} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              確定
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            {hasMultipleCameras && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleSwitchCamera}
              >
                <SwitchCamera className="h-5 w-5" />
              </Button>
            )}
            <Button
              size="lg"
              onClick={handleCapture}
              disabled={isLoading}
              className="px-8"
            >
              <Camera className="h-5 w-5 mr-2" />
              撮影
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
