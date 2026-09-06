import { StoreNiche, StoreColors, StoreSection } from "../api/types";

export interface StoreTemplateDef {
  id: string;
  name: string;
  niche: StoreNiche;
  headline: string;
  subheadline: string;
  announcement: string;
  badge: string;
  previewImage: string;
  colors: StoreColors;
  benefits: {
    b1Title: string;
    b1Desc: string;
    b2Title: string;
    b2Desc: string;
    b3Title: string;
    b3Desc: string;
    b4Title: string;
    b4Desc: string;
  };
  defaultSections: StoreSection[];
}

export const STORE_TEMPLATES: StoreTemplateDef[] = [
  // 1. MULHER & BELEZA
  {
    id: "template-mulher-beleza",
    name: "Glow & Co. Luxury Woman",
    niche: "Mulher & Beleza",
    headline: "Sua Essência, Seu Brilho e Cuidado Diário",
    subheadline: "Cosméticos de alta performance, maquiagens premium e cuidados com a pele recomendados por especialistas.",
    announcement: "✨ GANHE 15% OFF NA PRIMEIRA COMPRA + FRETE FULL GRÁTIS COM O CUPOM GLOW15",
    badge: "🔥 TOP VENDAS #1",
    previewImage: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800",
    colors: {
      primary: "#f43f5e",
      secondary: "#fb7185",
      background: "#0f0b0d",
      surface: "#1a1215",
      text: "#fdf2f8",
      textMuted: "#9d8ba2",
      border: "#331f28",
    },
    benefits: {
      b1Title: "Fórmulas Dermatológicas",
      b1Desc: "Testado e aprovado com ativos nobres",
      b2Title: "Despacho Express FULL",
      b2Desc: "Envio imediato em embalagem discreta",
      b3Title: "Cruelty Free 100%",
      b3Desc: "Sem testes em animais, livre de parabenos",
      b4Title: "Garantia Glow 30 Dias",
      b4Desc: "Satisfação total ou seu dinheiro de volta",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Benefícios da Marca", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Coleção em Destaque", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Clube de Vantagens", enabled: true },
    ],
  },

  // 2. PET SHOP & CUIDADOS
  {
    id: "template-pet-shop",
    name: "PetLover Express",
    niche: "Pet Shop & Cuidados",
    headline: "Tudo Para a Felicidade e Saúde do Seu Pet",
    subheadline: "Acessórios ergonômicos, petiscos saudáveis, brinquedos inteligentes e nutrição de primeira linha.",
    announcement: "🐾 FRETE FULL EXPRESS EM RAÇÕES E ACESSÓRIOS PARA TODO O BRASIL",
    badge: "🐶 TOP PET 2026",
    previewImage: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800",
    colors: {
      primary: "#f59e0b",
      secondary: "#10b981",
      background: "#0d0e11",
      surface: "#171920",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      border: "#292e3d",
    },
    benefits: {
      b1Title: "Aprovado por Veterinários",
      b1Desc: "Seleção rigorosa de qualidade",
      b2Title: "Chega no Mesmo Dia",
      b2Desc: "Logística FULL para capitais",
      b3Title: "Troca Sem Burocracia",
      b3Desc: "Se o pet não amar, trocamos na hora",
      b4Title: "Programa Amigo Fiel",
      b4Desc: "Cashback em todas as compras",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Benefícios Pet", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Mais Queridos dos Pets", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Newsletter Pet", enabled: true },
    ],
  },

  // 3. FITNESS & ACADEMIA
  {
    id: "template-fitness-performance",
    name: "IronPeak Performance",
    niche: "Fitness & Academia",
    headline: "Supere Seus Limites com Equipamentos Pro",
    subheadline: "Vestuário de compressão, acessórios de hipertrofia, suplementos e tecnologia para o seu melhor treino.",
    announcement: "⚡ ENTREGA FULL EM 24H: SEU TREINO NÃO PODE PARAR! PARCELE EM ATÉ 12X",
    badge: "💪 ALTA CONVERSÃO",
    previewImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800",
    colors: {
      primary: "#ef4444",
      secondary: "#f97316",
      background: "#08080a",
      surface: "#131317",
      text: "#ffffff",
      textMuted: "#8b8b9e",
      border: "#2b2226",
    },
    benefits: {
      b1Title: "Alta Resistência Militar",
      b1Desc: "Materiais testados sob carga extrema",
      b2Title: "Pronta Entrega CD FULL",
      b2Desc: "Despacho no mesmo dia até às 14h",
      b3Title: "Tabela de Medidas Real",
      b3Desc: "Caimento anatômico perfeito",
      b4Title: "Garantia Vitalícia",
      b4Desc: "Em acessórios selecionados da linha",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Benefícios IronPeak", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Linha Performance", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Comunidade de Treino", enabled: true },
    ],
  },

  // 4. SAÚDE & BEM-ESTAR
  {
    id: "template-saude-bem-estar",
    name: "Vitalis Saúde & Vida",
    niche: "Saúde & Bem-Estar",
    headline: "Viva com Mais Equilíbrio, Vitalidade e Saúde",
    subheadline: "Produtos ortopédicos, suplementos puros, massageadores terapêuticos e ergonomia para o seu bem-estar diário.",
    announcement: "🌿 PRODUTOS CERTIFICADOS PELA ANVISA COM FRETE RÁPIDO PARA TODO O BRASIL",
    badge: "🩺 NOTA 4.9/5",
    previewImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800",
    colors: {
      primary: "#10b981",
      secondary: "#06b6d4",
      background: "#080f0c",
      surface: "#101d18",
      text: "#f0fdf4",
      textMuted: "#86efac",
      border: "#1a382b",
    },
    benefits: {
      b1Title: "Certificação de Qualidade",
      b1Desc: "Atóxico e clinicamente aprovado",
      b2Title: "Alívio Imediato",
      b2Desc: "Design focado em alinhamento corporal",
      b3Title: "Atendimento com Especialistas",
      b3Desc: "Suporte dedicado no WhatsApp",
      b4Title: "Garantia de 30 Dias",
      b4Desc: "Devolução 100% gratuita",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Diferenciais Clínicos", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Mais Vendidos", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Dicas de Saúde", enabled: true },
    ],
  },

  // 5. CRIANÇA & BEBÊ
  {
    id: "template-crianca-bebe",
    name: "Bebê Carinho & Kids",
    niche: "Criança & Bebê",
    headline: "O Maior Cuidado e Segurança Para Quem Você Mais Ama",
    subheadline: "Enxoval, brinquedos educativos Montessori, acessórios para alimentação e segurança do recém-nascido.",
    announcement: "👶 COMPRA 100% SEGURA: MATERIAIS LIVRES DE BPA E HIPOALERGÊNICOS COM FRETE FULL",
    badge: "🍼 MAMÃES RECOMENDAM",
    previewImage: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800",
    colors: {
      primary: "#06b6d4",
      secondary: "#f472b6",
      background: "#0c0f14",
      surface: "#141c28",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      border: "#1f2e45",
    },
    benefits: {
      b1Title: "100% Livre de BPA",
      b1Desc: "Materiais seguros e macios",
      b2Title: "Design Ergonômico",
      b2Desc: "Auxilia no desenvolvimento infantil",
      b3Title: "Entrega Express 24h",
      b3Desc: "Porque os pais não podem esperar",
      b4Title: "Troca Facilitada",
      b4Desc: "30 dias para testar tranquilamente",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Segurança do Bebê", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Favoritos dos Pais", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Clube da Maternidade", enabled: true },
    ],
  },

  // 6. VESTUÁRIO & STREETWEAR
  {
    id: "template-vestuario-streetwear",
    name: "Urban Vogue Streetwear",
    niche: "Vestuário & Streetwear",
    headline: "Autenticidade, Estilo e Atitude Urbana",
    subheadline: "Modelagens oversize, cortes modernos, tecidos de gramatura pesada e coleções exclusivas de edição limitada.",
    announcement: "🔥 DROP EXCLUSIVO 2026: FRETE GRÁTIS ACIMA DE R$ 199 E PARCELAMENTO EM 10X",
    badge: "⚡ DROP LIMITADO",
    previewImage: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800",
    colors: {
      primary: "#a855f7",
      secondary: "#e2e8f0",
      background: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      border: "#27272a",
    },
    benefits: {
      b1Title: "Algodão 100% Penteado",
      b1Desc: "Gramatura pesada 220g que não encolhe",
      b2Title: "Corte Oversized Exclusivo",
      b2Desc: "Caimento impecável e acabamento premium",
      b3Title: "Primeira Troca Grátis",
      b3Desc: "Código de logística reversa sem custo",
      b4Title: "Envio FULL Rastreado",
      b4Desc: "Código enviado no WhatsApp em 2 horas",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Diferenciais Urban", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Novos Drops", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Lista VIP de Lançamentos", enabled: true },
    ],
  },

  // 7. FUTEBOL & ARTIGOS ESPORTIVOS
  {
    id: "template-futebol-esportes",
    name: "Gol de Placa Esportes",
    niche: "Futebol & Artigos Esportivos",
    headline: "A Paixão do Futebol Dentro e Fora de Campo",
    subheadline: "Mantos oficiais retrô, chuteiras profissionais, caneleiras de fibra e acessórios para o boleiro raiz.",
    announcement: "⚽ PERSONALIZAÇÃO DE NOME E NÚMERO GRÁTIS COM ENVIO IMEDIATO NO FULL",
    badge: "🏆 100% ORIGINAL",
    previewImage: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
    colors: {
      primary: "#22c55e",
      secondary: "#eab308",
      background: "#0a0f0d",
      surface: "#111c16",
      text: "#f0fdf4",
      textMuted: "#86efac",
      border: "#1e3a29",
    },
    benefits: {
      b1Title: "Tecido Dry-Fit Pro",
      b1Desc: "Ventilação máxima e absorção térmica",
      b2Title: "Escudos Bordados de Alta Definição",
      b2Desc: "Acabamento oficial impecável",
      b3Title: "Despacho em 24h",
      b3Desc: "Pronta entrega saindo do CD São Paulo",
      b4Title: "Garantia de Autenticidade",
      b4Desc: "Etiquetas e selos de conformidade",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Diferenciais do Boleiro", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Mantos Sagrados", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Torcida VIP", enabled: true },
    ],
  },

  // 8. TECNOLOGIA & GADGETS
  {
    id: "template-tecnologia-gadgets",
    name: "CyberTech Pro",
    niche: "Tecnologia & Gadgets",
    headline: "Inovação, Produtividade e Eletrônicos Inteligentes",
    subheadline: "Smartwatches, hubs multiporta, fones com cancelamento de ruído ativo e gadgets essenciais para o seu setup.",
    announcement: "🚀 PARCELE EM ATÉ 12X SEM JUROS E RECEBA AMANHÃ COM LOGÍSTICA FULL",
    badge: "⚡ TECH TENDÊNCIA",
    previewImage: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800",
    colors: {
      primary: "#38bdf8",
      secondary: "#6366f1",
      background: "#060913",
      surface: "#0e1526",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      border: "#1e293b",
    },
    benefits: {
      b1Title: "Chipsets Originais de Última Geração",
      b1Desc: "Maior autonomia de bateria e resposta veloz",
      b2Title: "Garantia Nacional de 12 Meses",
      b2Desc: "Suporte e assistência direta no Brasil",
      b3Title: "Certificação Anatel",
      b3Desc: "Compatibilidade total com redes nacionais",
      b4Title: "Entrega FULL em 24 Horas",
      b4Desc: "Centros de Distribuição SP, PR e MG",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Garantia Tech", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Gadgets Mais Vendidos", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Radar Tech", enabled: true },
    ],
  },

  // 9. CASA & COZINHA / DECORAÇÃO
  {
    id: "template-casa-cozinha",
    name: "Casa Prática & Decor",
    niche: "Casa & Decoração",
    headline: "Transforme Seu Lar com Praticidade e Bom Gosto",
    subheadline: "Organizadores inteligentes, iluminação acolhedora, utensílios de chef e decoração que encanta em cada detalhe.",
    announcement: "🏡 RENOVE SUA CASA: FRETE GRÁTIS EM COMPRAS ACIMA DE R$ 149 PARA TODO O PAÍS",
    badge: "⭐ 4.9 EM DESIGN",
    previewImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800",
    colors: {
      primary: "#14b8a6",
      secondary: "#f59e0b",
      background: "#0c0d10",
      surface: "#161920",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      border: "#262b37",
    },
    benefits: {
      b1Title: "Design Funcional & Ergonômico",
      b1Desc: "Otimiza espaço e decora com elegância",
      b2Title: "Materiais Duráveis e Atóxicos",
      b2Desc: "Inox 304, bambu ecológico e silicone BPA free",
      b3Title: "Embalagem Anti-Impacto Reforçada",
      b3Desc: "Seu produto chega intacto sem nenhum risco",
      b4Title: "30 Dias de Teste no Seu Lar",
      b4Desc: "Satisfação garantida ou troca sem custo",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Diferenciais Casa", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Queridinhos da Cozinha", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Clube Casa Prática", enabled: true },
    ],
  },

  // 10. JOIAS & LUXO
  {
    id: "template-joias-luxo",
    name: "Aura Gold & Diamond",
    niche: "Joias & Luxo",
    headline: "O Luxo Atemporal em Cada Detalhe e Lapidação",
    subheadline: "Semijoias finas com banho em ouro 18k e prata 925, pedras naturais selecionadas e garantia eterna de brilho.",
    announcement: "💎 CAIXA DE PRESENTE PREMIUM EXCLUSIVA EM TODOS OS PEDIDOS + CERTIFICADO DE GARANTIA",
    badge: "👑 ALTA JOALHERIA",
    previewImage: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800",
    colors: {
      primary: "#eab308",
      secondary: "#ca8a04",
      background: "#090806",
      surface: "#17140e",
      text: "#fef08a",
      textMuted: "#a1824a",
      border: "#3d321c",
    },
    benefits: {
      b1Title: "Banho de 10 Camadas de Ouro 18k",
      b1Desc: "Durabilidade comprovada e acabamento espelhado",
      b2Title: "100% Antialérgico e Níquel Free",
      b2Desc: "Não causa irritações nem escurece a pele",
      b3Title: "Embalagem Estojo de Veludo Grátis",
      b3Desc: "Perfeito para presentear quem você ama",
      b4Title: "Certificado de Garantia Eterna",
      b4Desc: "Qualidade atestada e suporte permanente",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Diferenciais de Luxo", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Coleção Real", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Acesso Exclusivo VIP", enabled: true },
    ],
  },

  // 11. GAMER & SETUP
  {
    id: "template-gamer-setup",
    name: "Nexus Gamer Zone",
    niche: "Gamer & Setup",
    headline: "Domine o Jogo com o Setup de Alta Performance",
    subheadline: "Teclados mecânicos ópticos, mouses ultraleves de 26.000 DPI, headsets 7.1 surround e iluminação RGB de estúdio.",
    announcement: "🕹️ PRONTA ENTREGA FULL: SUBINDO DE ELO EM 24 HORAS! ATÉ 12X SEM JUROS",
    badge: "⚡ PRO ESPORTS",
    previewImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800",
    colors: {
      primary: "#8b5cf6",
      secondary: "#06b6d4",
      background: "#090712",
      surface: "#141026",
      text: "#f5f3ff",
      textMuted: "#8b5cf6",
      border: "#2a1f4a",
    },
    benefits: {
      b1Title: "Switches Mecânicos de 100M de Cliques",
      b1Desc: "Tempo de resposta de 0.2ms sem ghosting",
      b2Title: "Sensor Óptico PixArt Flagship",
      b2Desc: "Precisão milimétrica para mira competitiva",
      b3Title: "Software de Customização de Macros",
      b3Desc: "Perfis na memória onboard do periférico",
      b4Title: "Entrega Ninja FULL",
      b4Desc: "Receba amanhã para a maratona de ranked",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Vantagem Competitiva", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Arsenal Gamer", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Guilda Nexus VIP", enabled: true },
    ],
  },

  // 12. AUTOMOTIVO & FERRAMENTAS
  {
    id: "template-automotivo-ferramentas",
    name: "AutoPro Performance",
    niche: "Automotivo & Ferramentas",
    headline: "Cuidado Profissional e Potência Para Seu Veículo",
    subheadline: "Estética automotiva de cerâmica, compressores portáteis, scanners OBD2 e ferramentas de alta precisão.",
    announcement: "🚗 QUALIDADE PROFISSIONAL DE OFICINA: ENTREGA FULL COM NOTA FISCAL E GARANTIA",
    badge: "🛠️ LINHA PROFISSIONAL",
    previewImage: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800",
    colors: {
      primary: "#ea580c",
      secondary: "#64748b",
      background: "#0b0c0e",
      surface: "#15181d",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      border: "#292f39",
    },
    benefits: {
      b1Title: "Aço Cromo-Vanádio Forjado",
      b1Desc: "Resistência máxima contra torque e desgaste",
      b2Title: "Compatibilidade Universal",
      b2Desc: "Testado em veículos nacionais e importados",
      b3Title: "Despacho Rápido em 24 Horas",
      b3Desc: "Centros de Distribuição com estoque real",
      b4Title: "Garantia de 1 Ano",
      b4Desc: "Substituição imediata sem burocracia",
    },
    defaultSections: [
      { id: "sec-ann", type: "announcement", title: "Barra de Comunicado", enabled: true },
      { id: "sec-hero", type: "hero", title: "Banner Principal", enabled: true },
      { id: "sec-ben", type: "benefits", title: "Diferenciais AutoPro", enabled: true },
      { id: "sec-feat", type: "featured_products", title: "Mais Vendidos da Oficina", enabled: true },
      { id: "sec-news", type: "newsletter", title: "Clube do Motor", enabled: true },
    ],
  },
];
