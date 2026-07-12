import { LayoutDashboard, UserPlus, Target, Shield, Upload, AlertTriangle, DollarSign, Briefcase, Paperclip, Users } from "lucide-react";

/* ============================================================================
   NAV GROUPS — Fase 1 + Fase 2 + Fase 3 (em entrega)
   Reflete só o que já existe e está funcional hoje. Itens de fases futuras
   (Atendimento, Renovações fora do Kanban, Inativos, Metas) entram aqui
   conforme cada fase for entregue — de propósito, não criamos
   placeholders/links mortos na sidebar.

   Este arquivo só exporta dados (nenhum componente React) de propósito: é o
   que a regra do ESLint react-refresh/only-export-components exige para não
   conflitar com o Layout.jsx, que exporta um componente.
   ============================================================================ */
export const navGroups = [
  {
    title: "Visão Geral",
    items: [{ key: "home", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Vendas",
    items: [
      { key: "prospeccoes", label: "Captação", icon: UserPlus },
      { key: "crosssell", label: "Cross-sell", icon: Target },
    ],
  },
  {
    title: "Operações",
    items: [
      { key: "pipeline", label: "Pipeline", icon: Shield },
      { key: "sinistros", label: "Sinistros", icon: AlertTriangle },
      { key: "comissoes", label: "Comissões", icon: DollarSign },
      { key: "documentos", label: "Documentos", icon: Paperclip },
      { key: "importarpdf", label: "Importar PDF", icon: Upload },
    ],
  },
  {
    title: "Carteira",
    items: [
      { key: "segurados", label: "Clientes", icon: Users },
      { key: "apolices", label: "Apólices", icon: Briefcase },
    ],
  },
];
