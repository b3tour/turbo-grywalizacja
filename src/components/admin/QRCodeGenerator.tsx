'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Card, Button } from '@/components/ui';
import { Download, Copy, RefreshCw, Check, QrCode } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface QRCodeGeneratorProps {
  value: string;
  missionTitle?: string;
  size?: number;
  onValueChange?: (value: string) => void;
}

export default function QRCodeGenerator({
  value,
  missionTitle = 'Misja QR',
  size = 256,
  onValueChange
}: QRCodeGeneratorProps) {
  const { success } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (value) {
      generateQR(value);
    }
  }, [value]);

  const generateQR = async (text: string) => {
    try {
      const url = await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Error generating QR:', err);
    }
  };

  const generateNewCode = () => {
    const newCode = `TURBO_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    if (onValueChange) {
      onValueChange(newCode);
    }
    generateQR(newCode);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${missionTitle.replace(/\s+/g, '_')}_${value.slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('Pobrano!', 'Kod QR został pobrany');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      success('Skopiowano!', 'Kod został skopiowany do schowka');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!value) {
    return (
      <Card className="text-center py-8 border-dashed border-2 border-dark-600">
        <QrCode className="w-12 h-12 text-dark-500 mx-auto mb-3" />
        <p className="text-dark-400 mb-4">Wygeneruj kod QR dla misji</p>
        <Button onClick={generateNewCode}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Generuj kod QR
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center">
        {/* QR Code display */}
        {qrDataUrl && (
          <div className="bg-white p-4 rounded-xl mb-4">
            <img
              src={qrDataUrl}
              alt={`QR Code: ${value}`}
              width={size}
              height={size}
              className="block"
            />
          </div>
        )}

        {/* Code value */}
        <div className="w-full mb-4">
          <p className="text-xs text-dark-400 text-center mb-1">Wartość kodu:</p>
          <div className="bg-dark-700 rounded-lg px-3 py-2 text-center">
            <code className="text-sm text-turbo-400 break-all">{value}</code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            Pobierz PNG
          </Button>
          <Button size="sm" variant="secondary" onClick={handleCopyCode}>
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Skopiowano
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Kopiuj kod
              </>
            )}
          </Button>
          <Button size="sm" variant="secondary" onClick={generateNewCode}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Nowy kod
          </Button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-dark-500 text-center mt-4">
          Pobierz i wydrukuj kod QR, a następnie umieść go w lokalizacji misji.
        </p>
      </div>
    </Card>
  );
}
