import React, { useState } from "react";
import { UrlImportClient, AnalyzeUrlResponse, CommitImportResponse } from "@/lib/api/urlImport";

export type ImportUiState =
  | "IDLE"
  | "ANALYZING"
  | "ASSISTED_REQUIRED"
  | "FOUND"
  | "EDITING"
  | "IMPORTING"
  | "IMPORTED"
  | "ALREADY_IMPORTED"
  | "ERROR";

export interface UrlProductImportPageProps {
  tenantId?: string;
  onNavigateToProducts?: () => void;
  onOpenProduct?: (productId: string) => void;
}

export const UrlProductImportPage: React.FC<UrlProductImportPageProps> = ({
  tenantId = "tenant_lojista_araruama",
  onNavigateToProducts,
  onOpenProduct,
}) => {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ImportUiState>("IDLE");
  const [analyzingStep, setAnalyzingStep] = useState("Identificando marketplace...");
  const [markupPercent, setMarkupPercent] = useState<number>(40);

  // Editable fields
  const [editableTitle, setEditableTitle] = useState("");
  const [editableDescription, setEditableDescription] = useState("");
  const [editableCategory, setEditableCategory] = useState("");
  const [editableBrand, setEditableBrand] = useState("");
  const [editableSku, setEditableSku] = useState("");

  const [analyzeData, setAnalyzeData] = useState<AnalyzeUrlResponse | null>(null);
  const [commitData, setCommitData] = useState<CommitImportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Analyze URL
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setState("ANALYZING");
    setErrorMessage(null);
    setAnalyzeData(null);
    setCommitData(null);

    setAnalyzingStep("Validando URL e verificando segurança...");
    setTimeout(() => setAnalyzingStep("Identificando marketplace e cascata L1/L2/L3..."), 300);
    setTimeout(() => setAnalyzingStep("Extraindo informações estruturadas e galeria..."), 600);

    const res = await UrlImportClient.analyzeUrl(url, markupPercent, (newState) => {
      setState(newState);
      if (newState === "ASSISTED_REQUIRED") {
        setAnalyzingStep("Não conseguimos acessar esta página diretamente. Estamos usando uma leitura assistida do navegador para capturar o produto...");
      }
    });

    if (res.success && res.product && res.preview) {
      setAnalyzeData(res);
      setEditableTitle(res.product.title);
      setEditableDescription(res.product.description || "");
      setEditableCategory(res.product.category || "Geral");
      setEditableBrand(res.product.brand || "Marca do Produto");
      setEditableSku(res.product.sku || `PUB-${res.product.externalId}`);
      setState("FOUND");
    } else {
      setErrorMessage(res.error || "Não conseguimos extrair dados suficientes deste produto automaticamente.");
      setState("ERROR");
    }
  };

  // Calculate live sale price and profit from editable markup
  const originalCost = analyzeData?.product?.price || 0;
  const calculatedSalePrice = parseFloat((originalCost * (1 + markupPercent / 100)).toFixed(2));
  const calculatedProfit = parseFloat((calculatedSalePrice - originalCost).toFixed(2));

  // Step 2: Commit Import
  const handleCommit = async () => {
    if (!analyzeData?.product) return;

    setState("IMPORTING");
    setErrorMessage(null);

    const productToCommit = {
      ...analyzeData.product,
      title: editableTitle,
      description: editableDescription,
      category: editableCategory,
      brand: editableBrand,
      sku: editableSku,
    };

    const res = await UrlImportClient.commitImport(productToCommit, tenantId);
    setCommitData(res);

    if (res.success) {
      if (res.status === "ALREADY_IMPORTED") {
        setState("ALREADY_IMPORTED");
      } else {
        setState("IMPORTED");
      }
    } else {
      setErrorMessage(res.error || "Erro ao persistir produto no catálogo.");
      setState("ERROR");
    }
  };

  const handleReset = () => {
    setUrl("");
    setState("IDLE");
    setAnalyzeData(null);
    setCommitData(null);
    setErrorMessage(null);
  };

  return (
    <div className="pub-url-importer p-6 max-w-5xl mx-auto space-y-6 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
          Importar Produto por URL
        </h1>
        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">
          Cole o link de qualquer marketplace para importar ao catálogo interno do PUB ECOM
        </p>
      </div>

      {/* Input URL Section */}
      <form onSubmit={handleAnalyze} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        <label className="text-xs font-black text-zinc-300 uppercase tracking-wider block">
          Cole o link do produto:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://shopee.com.br/... ou https://produto.mercadolivre.com.br/..."
            disabled={state === "ANALYZING" || state === "IMPORTING"}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
          <button
            type="submit"
            disabled={state === "ANALYZING" || state === "IMPORTING" || !url.trim()}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-lg transition-colors shadow-lg shadow-red-600/20"
          >
            {state === "ANALYZING" ? "Analisando..." : "Analisar Produto"}
          </button>
        </div>
      </form>

      {/* State: ANALYZING */}
      {state === "ANALYZING" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full" />
          <p className="text-sm font-bold text-zinc-300 animate-pulse">{analyzingStep}</p>
        </div>
      )}

      {/* State: ASSISTED_REQUIRED */}
      {state === "ASSISTED_REQUIRED" && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-8 text-center space-y-4">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider">Leitura Assistida do Navegador</h4>
            <p className="text-xs text-zinc-300">
              Não conseguimos acessar esta página diretamente. Estamos usando uma leitura assistida do navegador para capturar o produto.
            </p>
          </div>
        </div>
      )}

      {/* State: ERROR */}
      {state === "ERROR" && (
        <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">Falha na Importação</h3>
          <p className="text-xs text-zinc-300">{errorMessage}</p>
          <button
            onClick={handleReset}
            className="text-xs font-bold text-red-400 hover:text-red-300 uppercase tracking-wider underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* State: FOUND / EDITING (PREVIEW) */}
      {(state === "FOUND" || state === "EDITING" || state === "IMPORTING") && analyzeData?.product && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-3 py-1 rounded-full">
              Produto Encontrado ({analyzeData.provider.toUpperCase()})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              Estratégia: {analyzeData.strategyUsed} ({analyzeData.durationMs}ms)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gallery Column */}
            <div className="space-y-3">
              <div className="aspect-square bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={analyzeData.product.images[0]}
                  alt="Produto"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[11px] text-zinc-400 text-center font-bold">
                {analyzeData.product.images.length} imagem(ns) encontrada(s)
              </p>
            </div>

            {/* Editable Form Column */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                  Título do Produto (Editável):
                </label>
                <input
                  type="text"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500"
                />
              </div>

              {/* Commercial Pricing Block */}
              <div className="grid grid-cols-3 gap-3 bg-zinc-950/80 p-4 border border-zinc-800 rounded-lg">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-black block">Preço de Custo:</span>
                  <span className="text-base font-black text-zinc-200">
                    R$ {originalCost.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-black block">Markup (%):</span>
                  <input
                    type="number"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase font-black block">Venda Sugerida:</span>
                  <span className="text-base font-black text-emerald-400">
                    R$ {calculatedSalePrice.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block font-bold">
                    Lucro: +R$ {calculatedProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                    Marca:
                  </label>
                  <input
                    type="text"
                    value={editableBrand}
                    onChange={(e) => setEditableBrand(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                    SKU:
                  </label>
                  <input
                    type="text"
                    value={editableSku}
                    onChange={(e) => setEditableSku(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
                  Descrição do Produto:
                </label>
                <textarea
                  rows={3}
                  value={editableDescription}
                  onChange={(e) => setEditableDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 focus:border-red-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={state === "IMPORTING"}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={state === "IMPORTING"}
                  className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  {state === "IMPORTING" ? "Importando..." : "Importar para PUB ECOM"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State: IMPORTED (Success) */}
      {state === "IMPORTED" && commitData && (
        <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto text-white text-xl font-bold">
            ✓
          </div>
          <h2 className="text-xl font-black text-emerald-400 uppercase tracking-tight">
            Produto Importado com Sucesso!
          </h2>
          <p className="text-xs text-zinc-300">
            O produto <strong className="text-white">{editableTitle}</strong> foi gravado no catálogo interno do PUB ECOM.
          </p>
          <p className="text-[11px] font-mono text-zinc-400">ID: {commitData.productId}</p>
          <div className="flex justify-center gap-4 pt-2">
            <button
              onClick={handleReset}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg"
            >
              Importar Outro Produto
            </button>
            {onNavigateToProducts && (
              <button
                onClick={onNavigateToProducts}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg shadow-lg shadow-emerald-600/20"
              >
                Ver no Catálogo
              </button>
            )}
          </div>
        </div>
      )}

      {/* State: ALREADY_IMPORTED (Idempotence) */}
      {state === "ALREADY_IMPORTED" && commitData && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center mx-auto text-white text-xl font-bold">
            ℹ
          </div>
          <h2 className="text-xl font-black text-amber-400 uppercase tracking-tight">
            Produto Já Importado Anteriormente
          </h2>
          <p className="text-xs text-zinc-300">
            Este produto já existe no seu catálogo interno. Nenhuma duplicata foi criada.
          </p>
          <p className="text-[11px] font-mono text-zinc-400">ID: {commitData.productId}</p>
          <div className="flex justify-center gap-4 pt-2">
            <button
              onClick={handleReset}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg"
            >
              Importar Outro
            </button>
            {onOpenProduct && (
              <button
                onClick={() => onOpenProduct(commitData.productId!)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg"
              >
                Abrir Produto Existente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
