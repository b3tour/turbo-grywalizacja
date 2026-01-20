'use client';

import { useState, useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';
import { uploadFile } from '@/lib/supabase';

interface PhotoUploadProps {
  onUpload: (url: string) => void;
  onCancel: () => void;
  requirements?: string;
  userId: string;
  missionId: string;
}

export function PhotoUpload({
  onUpload,
  onCancel,
  requirements,
  userId,
  missionId,
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Walidacja
    if (!file.type.startsWith('image/')) {
      setError('Proszę wybrać plik graficzny (JPG, PNG, etc.)');
      return;
    }

    // Maksymalny rozmiar 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Plik jest zbyt duży. Maksymalny rozmiar to 10MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Utwórz podgląd
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      // Utwórz unikalną nazwę pliku
      const timestamp = Date.now();
      const extension = selectedFile.name.split('.').pop();
      const fileName = `${userId}/${missionId}/${timestamp}.${extension}`;

      const { url, error: uploadError } = await uploadFile(
        'mission-photos',
        fileName,
        selectedFile
      );

      if (uploadError || !url) {
        throw new Error(uploadError || 'Błąd przesyłania pliku');
      }

      onUpload(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przesyłania pliku');
    } finally {
      setUploading(false);
    }
  };

  const resetSelection = () => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="p-4">
      {requirements && (
        <div className="mb-4 p-3 bg-turbo-500/10 border border-turbo-500/30 rounded-xl">
          <p className="text-sm text-turbo-300">
            <strong>Wymagania:</strong> {requirements}
          </p>
        </div>
      )}

      {!preview ? (
        <div className="space-y-4">
          {/* Opcja: Zrób zdjęcie */}
          <div
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-dark-600 rounded-xl cursor-pointer hover:border-turbo-500 transition-colors"
          >
            <Camera className="w-8 h-8 text-turbo-500" />
            <div>
              <p className="font-medium text-white">Zrób zdjęcie</p>
              <p className="text-sm text-dark-400">Użyj aparatu telefonu</p>
            </div>
          </div>

          {/* Opcja: Wybierz z galerii */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-dark-600 rounded-xl cursor-pointer hover:border-turbo-500 transition-colors"
          >
            <Upload className="w-8 h-8 text-dark-400" />
            <div>
              <p className="font-medium text-white">Wybierz z galerii</p>
              <p className="text-sm text-dark-400">JPG, PNG do 10MB</p>
            </div>
          </div>

          {/* Ukryte inputy */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Podgląd zdjęcia */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-dark-800">
            <Image
              src={preview}
              alt="Podgląd zdjęcia"
              fill
              className="object-cover"
            />
            <button
              onClick={resetSelection}
              className="absolute top-2 right-2 p-2 bg-dark-900/80 rounded-full text-white hover:bg-dark-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Przyciski akcji */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={resetSelection}
              disabled={uploading}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Zmień zdjęcie
            </Button>
            <Button
              onClick={handleUpload}
              loading={uploading}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Przesyłanie...' : 'Wyślij zdjęcie'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Anuluj */}
      <Button
        variant="ghost"
        onClick={onCancel}
        fullWidth
        className="mt-4"
        disabled={uploading}
      >
        Anuluj
      </Button>
    </div>
  );
}
