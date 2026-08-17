import React, { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2, Monitor } from "lucide-react";

const RemoteViewer = ({ hostname }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Desconectado");
  const [monitors, setMonitors] = useState([]);
  const [activeMonitor, setActiveMonitor] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wsRef = useRef(null);

  const SERVER_IP = "172.21.20.14";

  useEffect(() => {
    if (!hostname) return;
    const wsUrl = `ws://${SERVER_IP}:8006/api/ws/operator/${hostname}`;
    setStatus("Conectando...");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("Conectado");
    ws.onerror = () => setStatus("Error de conexion");
    ws.onclose = () => setStatus("Desconectado");

    ws.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      // Mensaje de control (JSON corto): lista de monitores
      if (typeof data === "string" && data.length < 2000 && data.trim().startsWith("{")) {
        try {
          const msg = JSON.parse(data);
          if (msg.type === "monitors" && Array.isArray(msg.monitors)) {
            setMonitors(msg.monitors);
            if (msg.active) setActiveMonitor(msg.active);
          }
        } catch (_) {}
        return;
      }

      // Frame JPEG base64
      if (data.length < 100) return;
      const img = new Image();
      img.src = `data:image/jpeg;base64,${data}`;
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.drawImage(img, 0, 0);
      };
    };

    return () => {
      if (ws) ws.close();
    };
  }, [hostname]);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const getNormPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  };

  const onMouseMove = (e) => {
    const { x, y } = getNormPos(e);
    send({ type: "mouse", action: "move", x, y });
  };
  const onMouseDown = (e) => {
    e.preventDefault();
    const { x, y } = getNormPos(e);
    send({ type: "mouse", action: "down", x, y, button: e.button });
    canvasRef.current?.focus();
  };
  const onMouseUp = (e) => {
    e.preventDefault();
    const { x, y } = getNormPos(e);
    send({ type: "mouse", action: "up", x, y, button: e.button });
  };
  const onDoubleClick = (e) => {
    e.preventDefault();
    const { x, y } = getNormPos(e);
    send({ type: "mouse", action: "dblclick", x, y, button: e.button });
  };
  const onWheel = (e) => {
    e.preventDefault();
    const { x, y } = getNormPos(e);
    send({ type: "mouse", action: "scroll", x, y, dy: e.deltaY > 0 ? -1 : 1 });
  };
  const onKeyDown = (e) => {
    e.preventDefault();
    send({ type: "key", action: "down", key: e.key });
  };
  const onKeyUp = (e) => {
    e.preventDefault();
    send({ type: "key", action: "up", key: e.key });
  };

  const selectMonitor = (index) => {
    setActiveMonitor(index);
    send({ type: "select_monitor", index });
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        textAlign: "center",
        backgroundColor: "#1e1e1e",
        padding: isFullscreen ? "8px" : "15px",
        borderRadius: isFullscreen ? 0 : "8px",
        height: isFullscreen ? "100vh" : "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          marginBottom: "10px",
          color: "#fff",
          fontWeight: "bold",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        <span>
          Control Remoto: <span style={{ color: "#00bcd4" }}>{hostname}</span> |{" "}
          {status}
        </span>

        {monitors.length > 1 && (
          <span style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Monitor size={16} />
            {monitors.map((m) => (
              <button
                key={m.index}
                type="button"
                onClick={() => selectMonitor(m.index)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background: activeMonitor === m.index ? "#00bcd4" : "#333",
                  color: "#fff",
                  fontSize: "12px",
                }}
              >
                Pantalla {m.index}
              </button>
            ))}
          </span>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: "#333",
            color: "#fff",
            fontSize: "13px",
          }}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {isFullscreen ? "Salir" : "Pantalla completa"}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            cursor: "crosshair",
            maxWidth: "100%",
            maxHeight: isFullscreen ? "calc(100vh - 60px)" : "auto",
            height: "auto",
            display: "block",
            outline: "none",
            border: "2px solid #333",
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
};

export default RemoteViewer;
