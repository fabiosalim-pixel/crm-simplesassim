import { LayoutDashboard, UserPlus, Shield, Upload, Users } from "lucide-react";

/* ============================================================================
   NAV GROUPS — Fase 1
   Reflete só o que já existe e está funcional hoje. Itens de fases futuras
   (Atendimento, Apólices, Renovações, Inativos, Cross-sell, Metas, Comissões,
   Sinistros) entram aqui conforme cada fase for entregue — de propósito, não
   criamos placeholders/links mortos na sidebar.

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
    items: [{ key: "prospeccoes", label: "Captação", icon: UserPlus }],
  },
  {
    title: "Operações",
    items: [
      { key: "pipeline", label: "Pipeline", icon: Shield },
      { key: "documentos", label: "Documentos", icon: Upload },
    ],
  },
  {
    title: "Carteira",
    items: [{ key: "segurados", label: "Clientes", icon: Users }],
  },
];
