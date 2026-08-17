import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";

    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cx - rect.left, y: cy - rect.top };
    };
    const start = (e) => { drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setEmpty(false); e.preventDefault(); };
    const end = () => { if (!drawing.current) return; drawing.current = false; onChange && onChange(canvas.toDataURL("image/png")); };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange && onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-md border border-dashed border-border bg-secondary/40">
        <canvas ref={canvasRef} width={440} height={150} className="w-full touch-none rounded-md" data-testid="signature-canvas" />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Firme aquí</span>}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear} className="mt-1 text-muted-foreground">
        <Eraser className="h-3.5 w-3.5 mr-1" /> Limpiar firma
      </Button>
    </div>
  );
}
