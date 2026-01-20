'use client';

import { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { Modal, Button } from '@/components/ui';
import { ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react';

interface AvatarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (croppedImage: Blob) => void;
  isSaving?: boolean;
}

// Funkcja do tworzenia przyciętego obrazu
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Ustaw rozmiar canvas na rozmiar przyciętego obszaru
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Narysuj przycięty obraz
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Konwertuj na blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      },
      'image/jpeg',
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}

export function AvatarEditor({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  isSaving = false,
}: AvatarEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(croppedImage);
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 1));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dostosuj zdjęcie"
      size="lg"
    >
      <div className="space-y-4">
        {/* Cropper */}
        <div className="relative w-full h-72 bg-dark-800 rounded-xl overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>

          <div className="flex-1 max-w-32">
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-turbo-500"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-dark-600" />

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRotate}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Hints */}
        <p className="text-xs text-dark-400 text-center">
          Przeciągnij zdjęcie aby je przesunąć. Użyj suwaka lub scrolla aby przybliżyć.
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Anuluj
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Zapisz
          </Button>
        </div>
      </div>
    </Modal>
  );
}
