import * as React from "react";
import { cn } from "@/lib/utils";
import { Globe, MapPin, Eye, ShoppingBag, ShieldCheck, Smartphone, Laptop, Sparkles, Activity, Filter, Zap, RotateCw } from "lucide-react";

export interface GeoVisitor {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  ip: string;
  device: "mobile" | "desktop";
  page: string;
  action: "viewing" | "cart" | "checkout" | "purchased";
  productName?: string;
  productPrice?: number;
  timeOnSite: string;
  score: number; // 0-100
  socials: {
    instagramFollower: boolean;
    youtubeSubscriber: boolean;
    interactionCount: number;
  };
  gender: string;
  age: number;
}

interface WorldMapLiveProps {
  visitors: GeoVisitor[];
  selectedVisitor: GeoVisitor | null;
  onSelectVisitor: (v: GeoVisitor) => void;
}

// Low-poly continents data mapped with key coastline points (lat, lng)
const CONTINENTS_POLYGONS: [number, number][][] = [
  // South America
  [
    [12, -72], [10, -60], [5, -52], [-2, -44], [-8, -35], [-23, -42],
    [-35, -53], [-55, -67], [-53, -75], [-37, -73], [-18, -70], [-5, -81],
    [5, -77], [10, -75], [12, -72]
  ],
  // North America
  [
    [70, -160], [72, -130], [60, -85], [50, -55], [45, -65], [30, -80],
    [25, -80], [20, -97], [15, -93], [8, -77], [18, -105], [32, -117],
    [48, -125], [60, -145], [65, -168], [70, -160]
  ],
  // Europe
  [
    [71, 28], [65, 40], [55, 30], [45, 35], [40, 27], [36, -5],
    [43, -9], [48, -4], [54, 8], [58, 6], [63, 10], [70, 20], [71, 28]
  ],
  // Africa
  [
    [37, 10], [32, 32], [28, 34], [12, 44], [12, 51], [-5, 40],
    [-25, 33], [-34, 18], [-34, 26], [-15, 12], [5, 2], [5, -10],
    [15, -17], [28, -13], [35, -5], [37, 10]
  ],
  // Asia
  [
    [77, 105], [70, 180], [60, 165], [50, 140], [38, 120], [30, 122],
    [22, 114], [10, 107], [1, 104], [10, 92], [22, 90], [25, 68],
    [15, 53], [30, 48], [40, 50], [55, 60], [68, 75], [77, 105]
  ],
  // Australia
  [
    [-11, 142], [-15, 146], [-28, 153], [-37, 150], [-38, 140],
    [-32, 115], [-22, 114], [-15, 124], [-12, 136], [-11, 142]
  ]
];

export const WorldMapLive: React.FC<WorldMapLiveProps> = ({
  visitors,
  selectedVisitor,
  onSelectVisitor,
}) => {
  const [filterAction, setFilterAction] = React.useState<string>("all");
  const [rotation, setRotation] = React.useState<{ x: number; y: number }>({ x: 15, y: -45 });
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [autoRotate, setAutoRotate] = React.useState<boolean>(true);
  const lastMousePos = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Auto rotation ticker
  React.useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setRotation((prev) => ({ ...prev, y: (prev.y + 0.35) % 360 }));
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  // Project Spherical Coordinates (lat, lng) onto 3D Sphere viewport
  const project3D = (lat: number, lng: number, radius: number, cx: number, cy: number, rotX: number, rotY: number) => {
    const phi = (lat * Math.PI) / 180;
    const theta = ((lng + rotY) * Math.PI) / 180;
    const tilt = (rotX * Math.PI) / 180;

    const x0 = radius * Math.cos(phi) * Math.sin(theta);
    const y0 = -radius * Math.sin(phi);
    const z0 = radius * Math.cos(phi) * Math.cos(theta);

    const y1 = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
    const z1 = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);

    const isVisible = z1 > 0;
    return {
      x: cx + x0,
      y: cy + y1,
      z: z1,
      visible: isVisible,
    };
  };

  // Render 3D Earth Globe on HTML5 Canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.42;

    ctx.clearRect(0, 0, width, height);

    // 1. Atmosphere Radial Outer Glow
    const outerAtmosphere = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.35);
    outerAtmosphere.addColorStop(0, "rgba(56, 189, 248, 0.4)");
    outerAtmosphere.addColorStop(0.5, "rgba(14, 165, 233, 0.15)");
    outerAtmosphere.addColorStop(1, "rgba(3, 7, 18, 0)");
    ctx.fillStyle = outerAtmosphere;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // 2. Earth Sphere Base Ocean Shadow & Depth
    const oceanGrad = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.35,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    oceanGrad.addColorStop(0, "#082f49");
    oceanGrad.addColorStop(0.65, "#031525");
    oceanGrad.addColorStop(1, "#020712");

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = oceanGrad;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 3. Coordinate Grid Lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.18)";
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 4]);

    [-60, -30, 0, 30, 60].forEach((lat) => {
      ctx.beginPath();
      let started = false;
      for (let lng = -180; lng <= 180; lng += 5) {
        const p = project3D(lat, lng, radius, cx, cy, rotation.x, rotation.y);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    });

    for (let lng = -180; lng < 180; lng += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -85; lat <= 85; lat += 5) {
        const p = project3D(lat, lng, radius, cx, cy, rotation.x, rotation.y);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 4. Continents
    CONTINENTS_POLYGONS.forEach((polygon) => {
      ctx.beginPath();
      let hasVisible = false;
      polygon.forEach(([lat, lng], i) => {
        const p = project3D(lat, lng, radius, cx, cy, rotation.x, rotation.y);
        if (p.visible) hasVisible = true;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();

      if (hasVisible) {
        ctx.fillStyle = "rgba(14, 116, 144, 0.55)";
        ctx.fill();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });

    // 5. São Paulo Beacon & Arcs
    const sp = project3D(-23.55, -46.63, radius, cx, cy, rotation.x, rotation.y);
    if (sp.visible) {
      const majorHubs = [
        { lat: 25.76, lng: -80.19 },
        { lat: 50.11, lng: 8.68 },
        { lat: 35.67, lng: 139.65 },
      ];
      majorHubs.forEach((hub) => {
        const hp = project3D(hub.lat, hub.lng, radius, cx, cy, rotation.x, rotation.y);
        if (hp.visible) {
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          const midX = (sp.x + hp.x) / 2 + (sp.y - hp.y) * 0.2;
          const midY = (sp.y + hp.y) / 2 - (sp.x - hp.x) * 0.2;
          ctx.quadraticCurveTo(midX, midY, hp.x, hp.y);
          ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
    }

    // 6. Realistic 3D Specular Shading
    const specular = ctx.createRadialGradient(
      cx - radius * 0.4,
      cy - radius * 0.4,
      radius * 0.05,
      cx,
      cy,
      radius
    );
    specular.addColorStop(0, "rgba(255, 255, 255, 0.22)");
    specular.addColorStop(0.3, "rgba(56, 189, 248, 0.08)");
    specular.addColorStop(0.8, "rgba(0, 0, 0, 0.4)");
    specular.addColorStop(1, "rgba(0, 0, 0, 0.85)");
    ctx.fillStyle = specular;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 7. Outer Globe Rim Border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }, [rotation]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setRotation((prev) => ({
      x: Math.max(-60, Math.min(60, prev.x - dy * 0.4)),
      y: (prev.y + dx * 0.5) % 360,
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const getActionColor = (action: GeoVisitor["action"]) => {
    switch (action) {
      case "purchased":
        return "#22c55e"; // Emerald green
      case "checkout":
        return "#f59e0b"; // Amber gold
      case "cart":
        return "#38bdf8"; // Cyan blue
      default:
        return "#a855f7"; // Neon purple
    }
  };

  const getActionHabboBadge = (action: GeoVisitor["action"]) => {
    switch (action) {
      case "purchased":
        return { emoji: "🦆", label: "Compra Aprovada", bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" };
      case "checkout":
        return { emoji: "💰", label: "No Checkout", bg: "bg-amber-500/20 text-amber-400 border-amber-500/40" };
      case "cart":
        return { emoji: "🪙", label: "Com Carrinho", bg: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" };
      default:
        return { emoji: "💬", label: "Navegando", bg: "bg-purple-500/20 text-purple-400 border-purple-500/40" };
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    if (filterAction === "all") return true;
    return v.action === filterAction;
  });

  const totalCartValue = visitors.reduce((sum, v) => sum + (v.productPrice || 0), 0);
  const totalPurchases = visitors.filter((v) => v.action === "purchased").length;

  return (
    <div className="relative w-full aspect-[2/1] min-h-[460px] sm:min-h-[560px] bg-[#030712] border border-[var(--hub-border)] rounded-3xl overflow-hidden shadow-2xl group select-none">
      {/* Background Cyber Grid Matrix */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(56, 189, 248, 0.15) 0%, transparent 70%),
            linear-gradient(to right, #38bdf8 1px, transparent 1px),
            linear-gradient(to bottom, #38bdf8 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 4% 8%, 4% 8%",
        }}
      />

      {/* Top Telemetry Header Bar */}
      <div className="absolute top-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Globe className="h-5 w-5 animate-spin" style={{ animationDuration: "35s" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white italic">
                Globo Terrestre 3D • Telemetria LiveShop
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-black text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                EDGE LIVE
              </span>
            </div>
            <p className="text-[10px] font-mono text-cyan-400/70">
              Arraste para girar o globo • Anycast Cloudflare • São Paulo Core Hub • {filteredVisitors.length} Compradores Ativos
            </p>
          </div>
        </div>

        {/* Global Live Stats Ticker */}
        <div className="flex items-center gap-2 sm:gap-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span>🦆</span>
            <span>{totalPurchases} Vendas</span>
          </div>
          <div className="h-3 w-[1px] bg-white/20" />
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <span>🪙</span>
            <span>R$ {totalCartValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em Carrinhos</span>
          </div>
          <div className="h-3 w-[1px] bg-white/20" />
          <div className="flex items-center gap-1.5 text-purple-400 font-bold hidden md:flex">
            <Zap className="h-3.5 w-3.5" />
            <span>14ms Edge Latency</span>
          </div>
        </div>

        {/* Controls: Auto-Rotate & Action Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(
              "px-2.5 py-1 rounded-xl text-[10px] font-mono flex items-center gap-1.5 border transition-all pointer-events-auto",
              autoRotate
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-black/60 text-zinc-400 border-white/10"
            )}
            title="Pausar / Retomar Rotação Automática"
          >
            <RotateCw className={cn("h-3 w-3", autoRotate && "animate-spin")} style={{ animationDuration: "6s" }} />
            <span>{autoRotate ? "Auto Giro ON" : "Auto Giro OFF"}</span>
          </button>

          {/* Action Filter Pills */}
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[10px] font-bold">
            {[
              { id: "all", label: "Todos", icon: "🌐" },
              { id: "purchased", label: "Compras", icon: "🦆" },
              { id: "checkout", label: "Checkout", icon: "💰" },
              { id: "cart", label: "Carrinho", icon: "🪙" },
              { id: "viewing", label: "Visitas", icon: "💬" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterAction(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1",
                  filterAction === f.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3D Earth Globe HTML5 Canvas */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Interactive Buyer Markers Placed on the 3D Sphere Hemisphere */}
      {canvasRef.current && (
        <div className="absolute inset-0 pointer-events-none">
          {filteredVisitors.map((visitor) => {
            const cx = 500;
            const cy = 300;
            const radius = Math.min(1000, 600) * 0.42;

            const proj = project3D(visitor.lat, visitor.lng, radius, cx, cy, rotation.x, rotation.y);
            if (!proj.visible) return null;

            const color = getActionColor(visitor.action);
            const badge = getActionHabboBadge(visitor.action);
            const isSelected = selectedVisitor?.id === visitor.id;

            const leftPct = (proj.x / 1000) * 100;
            const topPct = (proj.y / 600) * 100;

            return (
              <div
                key={visitor.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVisitor(visitor);
                }}
                className="absolute z-30 cursor-pointer pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group/pin transition-all duration-100"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                }}
              >
                {/* Concentric Radar Wave */}
                <div
                  className="absolute -inset-3.5 rounded-full animate-ping opacity-60 pointer-events-none"
                  style={{ backgroundColor: color }}
                />
                <div
                  className="absolute -inset-1 rounded-full opacity-70 pointer-events-none"
                  style={{ backgroundColor: color }}
                />

                {/* Habbo Avatar Speech Bubble Pin */}
                <div
                  className={cn(
                    "relative flex items-center gap-1.5 px-2 py-1 rounded-xl shadow-2xl transition-all duration-300 backdrop-blur-md",
                    isSelected
                      ? "scale-115 ring-2 ring-white bg-black/90 border-2"
                      : "scale-90 hover:scale-110 bg-black/85 border"
                  )}
                  style={{ borderColor: color }}
                >
                  <span className="text-xs">{badge.emoji}</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black leading-tight text-white whitespace-nowrap">
                      {visitor.name.split(" ")[0]}
                    </span>
                    <span className="text-[8px] font-mono leading-none text-zinc-400 whitespace-nowrap">
                      {visitor.city}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SELECTED BUYER DOSSIER DRAWER (Card de Detalhes Completo do Comprador) */}
      {/* ========================================================================= */}
      {selectedVisitor && (
        <div className="absolute bottom-4 right-4 z-40 w-full max-w-sm bg-black/85 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-4 shadow-2xl shadow-cyan-500/20 text-white animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center text-xl shadow-lg">
                {getActionHabboBadge(selectedVisitor.action).emoji}
              </div>
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  {selectedVisitor.name}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                    Score: {selectedVisitor.score}
                  </span>
                </h4>
                <p className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-cyan-400" />
                  {selectedVisitor.city}, {selectedVisitor.state} ({selectedVisitor.country})
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectVisitor(null as any);
              }}
              className="text-zinc-400 hover:text-white text-xs font-bold px-2 py-1 bg-white/5 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg">
              <span className="text-zinc-400">Status da Jornada:</span>
              <span className={cn("px-2 py-0.5 rounded font-black text-[10px] border", getActionHabboBadge(selectedVisitor.action).bg)}>
                {getActionHabboBadge(selectedVisitor.action).label}
              </span>
            </div>

            {selectedVisitor.productName && (
              <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg">
                <span className="text-zinc-400">Produto no Radar:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[180px]">
                  {selectedVisitor.productName}
                </span>
              </div>
            )}

            {selectedVisitor.productPrice && (
              <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg">
                <span className="text-zinc-400">Valor do Ticket:</span>
                <span className="text-emerald-400 font-black">
                  R$ {selectedVisitor.productPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block">Dispositivo / IP:</span>
                <span className="text-zinc-300 font-bold capitalize">{selectedVisitor.device} • {selectedVisitor.ip}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-zinc-500 block">Tempo no Site:</span>
                <span className="text-zinc-300 font-bold">{selectedVisitor.timeOnSite}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
