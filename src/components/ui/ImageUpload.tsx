import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Camera, X, Image as ImageIcon, RotateCw, Trash2, AlertCircle, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Cropper, { Area } from 'react-easy-crop'

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string | null) => void;
  className?: string;
  label?: string;
  bucketName?: string;
  folder?: string;
  maxSize?: number;
}

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || isLocalhost();
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Map a `getUserMedia()` rejection (or an env-precondition failure) to a
 * user-facing message. Localised via the `t` translator passed in from the
 * component — keys live under `shared.form.image_upload.cam_err_*`.
 *
 * The HTTPS/localhost branch is a developer/edge condition that an end-user
 * cannot act on (it only fires when the app is served from a non-secure
 * non-localhost origin), so we keep it in plain French here rather than
 * adding a key that the production build would essentially never show.
 */
function getCameraErrorMessage(error: any, t: TFunction): string {
  console.log('Camera error details:', error);

  if (!isSecureContext()) {
    return "L'accès à la caméra nécessite HTTPS ou localhost.";
  }

  if (!navigator.mediaDevices) {
    return t('shared.form.image_upload.cam_err_not_supported');
  }

  if (error.name === 'NotAllowedError') {
    return t('shared.form.image_upload.cam_err_permission_denied');
  }

  if (error.name === 'NotFoundError') {
    return t('shared.form.image_upload.cam_err_not_found');
  }

  if (error.name === 'NotReadableError') {
    return t('shared.form.image_upload.cam_err_in_use');
  }

  if (error.name === 'OverconstrainedError') {
    return t('shared.form.image_upload.cam_err_overconstrained');
  }

  if (error.name === 'AbortError') {
    return t('shared.form.image_upload.cam_err_aborted');
  }

  if (error.name === 'TypeError') {
    return t('shared.form.image_upload.cam_err_config');
  }

  return error.message || t('shared.form.image_upload.cam_err_generic');
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = url;
  });
}

function getCroppedImg(
  imageUrl: string,
  pixelCrop: Area,
  outputFileName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        img,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const file = new File([blob], outputFileName, { type: 'image/jpeg' });
          resolve(file);
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    if (!imageUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = imageUrl;
  });
}

export function ImageUpload({
  value,
  onChange,
  className,
  label,
  bucketName = 'product-images',
  folder = '',
  maxSize = 5 * 1024 * 1024,
}: ImageUploadProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  /** Shorthand to keep the JSX readable; resolves `shared.form.image_upload.*`. */
  const ti = (key: string, opts?: Record<string, unknown>) =>
    t(`shared.form.image_upload.${key}`, opts);
  /** Default label falls back to the existing translated product-image label
      so consumers that don't pass `label` still get localised text. */
  const resolvedLabel = label ?? t('shared.form.image_label');
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropperImageReady, setCropperImageReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  useEffect(() => {
    if (showCropper && imageToCrop) {
      const img = new Image();
      img.onload = () => setCropperImageReady(true);
      img.onerror = () => {
        toast.error(ti('error_load'));
        handleCropCancel();
      };
      img.src = imageToCrop;
    }
  }, [showCropper, imageToCrop]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const uploadToSupabase = async (file: File | Blob, fileName: string): Promise<string> => {
    if (!user?.id) {
      throw new Error(ti('error_not_authenticated'));
    }

    try {
      const filePath = folder 
        ? `${folder}/${user.id}/${fileName}`
        : `${user.id}/${fileName}`;

      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase
        .storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.log('Supabase upload failed, using base64');
      throw error;
    }
  };

  const convertToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(ti('error_not_image'));
      return;
    }

    if (file.size > maxSize) {
      toast.error(ti('error_too_large', { size: (maxSize / 1024 / 1024).toFixed(0) }));
      return;
    }

    setIsUploading(true);
    setCameraError(null);

    try {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      try {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${file.name.split('.').pop() || 'jpg'}`;
        const url = await uploadToSupabase(file, fileName);
        setPreview(url);
        onChange?.(url);
        toast.success(ti('success_uploaded'));
      } catch (supabaseError: any) {
        console.warn('Supabase upload failed, using base64 fallback:', supabaseError?.message);
        const base64Url = await convertToBase64(file);
        setPreview(base64Url);
        onChange?.(base64Url);
        toast.success(ti('success_uploaded_offline'));
      }
    } catch (error: any) {
      console.error('File handling error:', error);
      toast.error(error.message || ti('error_processing'));
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
    // `ti` is a stable closure over `t` (i18next returns a stable function),
    // so omitting it from deps avoids re-creating `handleFile` on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSize, onChange, user, folder, bucketName]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showImageCropper = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(ti('error_not_image'));
      return;
    }

    if (file.size > maxSize) {
      toast.error(ti('error_too_large', { size: (maxSize / 1024 / 1024).toFixed(0) }));
      return;
    }

    const url = URL.createObjectURL(file);
    setCropperImageReady(false);
    setShowCropper(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setImageToCrop(null);
    setImageToCrop(url);
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !croppedAreaPixels) {
      toast.error(ti('error_crop'));
      return;
    }

    setShowCropper(false);
    setIsUploading(true);
    const url = imageToCrop;
    setImageToCrop(null);
    setCropperImageReady(false);

    try {
      const baseName = `crop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const croppedFile = await getCroppedImg(url, croppedAreaPixels, `${baseName}.jpg`);
      URL.revokeObjectURL(url);
      await handleFile(croppedFile);
    } catch (e) {
      console.error('Crop error:', e);
      toast.error(ti('error_cropping'));
      setIsUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
    }
    setShowCropper(false);
    setImageToCrop(null);
    setCroppedAreaPixels(null);
    setCropperImageReady(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      showImageCropper(files[0]);
    }
  }, [maxSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      showImageCropper(files[0]);
    }
  };

  const checkCameraAvailability = (): { available: boolean; message?: string } => {
    if (isMobile) {
      return { available: true };
    }
    
    if (typeof navigator === 'undefined') {
      return { available: false, message: 'Environnement non supporté' };
    }
    
    if (!navigator.mediaDevices) {
      return { available: false, message: ti('cam_err_not_supported') };
    }
    
    if (!navigator.mediaDevices.getUserMedia) {
      return { available: false, message: 'getUserMedia non supporté' };
    }
    
    if (!isSecureContext()) {
      return { 
        available: false, 
        message: 'Utilisez http://localhost:3000 au lieu de l\'adresse IP' 
      };
    }
    
    return { available: true };
  };

  const handleNativeCameraCapture = () => {
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  const handleNativeCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      showImageCropper(files[0]);
    }
    
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.value = '';
    }
  };

  const startCamera = async () => {
    if (isMobile) {
      handleNativeCameraCapture();
      return;
    }

    setCameraError(null);
    
    const availability = checkCameraAvailability();
    if (!availability.available) {
      console.log('Camera not available:', availability.message);
      const msg = availability.message || ti('error_camera_unavailable');
      setCameraError(msg);
      toast.error(msg);
      return;
    }

    console.log('=== Attempting to access camera (desktop mode ===');
    console.log('isSecureContext:', isSecureContext());
    console.log('isLocalhost:', isLocalhost());
    console.log('URL:', window.location.href);

    const videoConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    };

    try {
      console.log('Requesting camera access...');
      console.log('Constraints:', videoConstraints);
      
      let stream: MediaStream | null = null;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        console.log('Camera access granted with preferred constraints!');
      } catch (preferredError: any) {
        console.log('Preferred constraints failed:', preferredError.name, preferredError.message);
        console.log('Trying with simple constraints...');
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          console.log('Camera access granted with simple constraints!');
        } catch (simpleError: any) {
          console.log('Simple constraints failed:', simpleError.name, simpleError.message);
          throw simpleError;
        }
      }
      
      if (!stream) {
        throw new Error(ti('error_video_stream'));
      }
      
      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraError(null);
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        video.muted = true;
        video.playsInline = true;
        video.autoPlay = true;
        
        const startPlayback = () => {
          video.play()
            .then(() => console.log('Video playback started successfully'))
            .catch(playError => {
              console.error('Video play error:', playError);
            });
        };
        
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          startPlayback();
        };
        
        video.onerror = (e) => {
          console.error('Video element error:', e);
        };
        
        video.srcObject = stream;
        
        setTimeout(() => {
          if (video && video.readyState < 1) {
            console.log('Metadata not loaded after timeout, trying direct play...');
            startPlayback();
          }
        }, 1000);
      }
     } catch (error: any) {
      console.error('=== CAMERA ERROR ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      
      const userMessage = getCameraErrorMessage(error, t);
      setCameraError(userMessage);
      toast.error(userMessage, { duration: 6000 });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error(ti('error_capture'));
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error(ti('error_capture'));
      return;
    }

    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log('Photo captured, size:', blob.size, 'bytes');
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          stopCamera();
          showImageCropper(file);
        } else {
          toast.error(ti('error_create_image'));
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const removeImage = () => {
    setPreview(null);
    setCameraError(null);
    onChange?.(null);
    stopCamera();
  };

  const isCameraSupported = checkCameraAvailability().available;

  return (
    <div className={cn("space-y-4", className)}>
      {resolvedLabel && (
        <label className="text-sm font-medium text-foreground">
          {resolvedLabel}
        </label>
      )}

      {showCropper && imageToCrop && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="relative flex-1">
            {!cropperImageReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-sm">{ti('cropper_loading')}</div>
              </div>
            )}
            {cropperImageReady && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1 / 1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={true}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-4 p-4 bg-black/80">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCropCancel}
              className="bg-white/20 hover:bg-white/30 text-white border-0 min-w-[100px]"
            >
              <X className="h-4 w-4 mr-2" />
              {ti('cancel_button')}
            </Button>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24 h-1 accent-white cursor-pointer"
              />
              <Button
                type="button"
                onClick={handleCropConfirm}
                className="bg-primary hover:bg-primary/90 min-w-[120px]"
                disabled={!croppedAreaPixels}
              >
                <Check className="h-4 w-4 mr-2" />
                {ti('confirm_button')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!showCropper && <canvas ref={canvasRef} className="hidden" />}

      {/* File picker input is mounted at the top level — NOT inside the
          empty-state drop-zone branch — so `fileInputRef.current` stays a
          valid DOM node when a preview is showing. Previously this input
          only existed in the empty-state branch, which meant the
          "Changer l'image" button (visible only when `preview` is set)
          had a null ref and `.click()` was a no-op.

          Note: we wrap the onChange to reset `.value = ''` so that
          selecting the SAME file twice in a row still fires `change` —
          otherwise the browser dedupes identical selections and the user
          can't re-pick the same image after deleting it. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={(e) => {
          handleFileInputChange(e);
          // Allow re-selecting the same filename later.
          e.currentTarget.value = '';
        }}
        disabled={isUploading}
      />

      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraInputChange}
        disabled={isUploading}
      />

      {!isMobile && !isCameraSupported && !isCameraActive && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            {/* Localhost branch shows the user-actionable message (translated).
                Non-localhost branch is a deploy/dev edge that an end-user
                cannot fix, so we keep the raw hostname diagnostic in French. */}
            {isLocalhost()
              ? ti('camera_check_device')
              : `Utilisez http://localhost:3000 (actuellement: ${window.location.hostname})`}
          </span>
        </div>
      )}

      {cameraError && !isCameraActive && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{ti('camera_unavailable_title')}</p>
            <p className="text-xs mt-1 opacity-80">{cameraError}</p>
            <p className="text-xs mt-1">{ti('camera_use_import_instead')}</p>
          </div>
        </div>
      )}

      {isCameraActive ? (
        <div className="relative rounded-[6px] overflow-hidden border-2 border-emerald-500 bg-black">
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover min-h-[240px]"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/20 rounded-full" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={stopCamera}
                className="bg-white/90 hover:bg-white text-slate-800"
              >
                <X className="h-4 w-4 mr-2" />
                {ti('cancel_button')}
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                className="bg-primary hover:bg-primary/90 min-w-[120px]"
              >
                <Camera className="h-5 w-5 mr-2" />
                {ti('capture_button')}
              </Button>
            </div>
          </div>
        </div>
      ) : preview ? (
        <div className="relative rounded-[6px] overflow-hidden border-2 border-slate-200 bg-slate-50/50">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-contain"
            onError={(e) => {
              console.error('Image preview error');
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* Only the delete button stays in the image's top-right corner.
              The redundant upload-icon button used to sit next to it; it has
              been removed in favour of the larger, clearly-labelled
              "Changer l'image" button shown below the preview. While an
              upload is in-flight the delete button is swapped for a spinner
              so the user gets feedback without an extra control. */}
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={removeImage}
              disabled={isUploading}
              className="bg-white/90 hover:bg-white text-rose-600 h-9 w-9 shadow-none border border-slate-200"
            >
              {isUploading ? (
                <RotateCw className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-[6px] p-8 text-center transition-all cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          {/* The hidden <input type="file"> previously rendered here was
              moved to the top-level of the component so its ref remains
              valid in every render branch (empty / preview / camera). */}

          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "p-4 rounded-full",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}>
              <ImageIcon className={cn(
                "h-8 w-8",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isDragging ? ti('dragging_title') : ti('empty_title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {ti('empty_subtitle')}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {ti('empty_formats', { size: (maxSize / 1024 / 1024).toFixed(0) })}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isCameraActive && (
        <div className="flex flex-col sm:flex-row gap-2">
          {!preview && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 min-w-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{ti('import_button')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 min-w-0",
                  !isCameraSupported && "opacity-50"
                )}
                onClick={startCamera}
                disabled={isUploading}
              >
                <Camera className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{ti('take_photo_button')}</span>
              </Button>
            </>
          )}
          {preview && (
            <>
              {/* "Changer l'image" — opens the OS file picker so the user can
                  swap the currently-uploaded image for another file from
                  their device. This replaces the small upload-icon button
                  that previously sat next to the delete icon in the preview
                  corner, giving the action a clear, discoverable label. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {ti('change_button')}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  !isCameraSupported && "opacity-50"
                )}
                onClick={startCamera}
                disabled={isUploading}
              >
                <Camera className="h-4 w-4 mr-2" />
                {ti('replace_with_photo_button')}
              </Button>
            </>
          )}
        </div>
      )}

      {!isCameraActive && !isMobile && (
        /* User-facing camera hint. The previous copy mentioned localhost:3000
           and HTTPS context which is a developer concern, not something an
           end-user can act on. The new message focuses on the one thing
           the user CAN do: allow the camera permission in their browser. */
        <p className="text-[11px] text-muted-foreground/70 text-center">
          {ti('camera_user_hint')}
        </p>
      )}
    </div>
  );
}
