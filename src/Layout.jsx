import { Shield, LogOut, Moon, Sun } from "lucide-react";
import { navGroups as defaultNavGroups } from "./navConfig";

function Sidebar({ navGroups, active, onNavigate, userName, userRole, onLogout, theme, onToggleTheme }) {
  return (
    <nav className="w-[225px] bg-[#0F2044] flex flex-col flex-shrink-0 h-full">
      {/* Marca */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#C9A84C] flex items-center justify-center flex-shrink-0">
            <Shield size={19} className="text-[#0F2044]" />
          </div>
          <div className="min-w-0">
            <div className="text-[#C9A84C] font-extrabold text-[15px] leading-none truncate">
              Simples Assim
            </div>
            <div className="text-white/40 text-[10px] mt-0.5">CRM</div>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="px-2.5 py-3.5 flex-1 overflow-y-auto">
        {navGroups.map((g) => (
          <div key={g.title} className="mb-3.5">
            <div className="text-[10px] text-white/30 font-bold tracking-wider uppercase px-2.5 mb-1.5">
              {g.title}
            </div>
            {g.items.map(({ key, label, icon: Icon }) => {
              const on = active === key;
              return (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-left text-[13px] transition-colors border-l-[3px] ${
                    on
                      ? "bg-[#C9A84C]/[0.13] text-[#C9A84C] font-bold border-[#C9A84C]"
                      : "text-white/55 hover:text-white/80 font-normal border-transparent"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rodapé: usuário + tema + logout */}
      <div className="px-4 py-3.5 border-t border-white/[0.07] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center font-extrabold text-[#0F2044] text-[13px] flex-shrink-0">
          {(userName || "A")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white text-[11px] font-bold truncate">{userName || "Administrador"}</div>
          <div className="text-white/35 text-[10px] truncate">{userRole || "Corretor"}</div>
        </div>
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className="text-white/40 hover:text-[#C9A84C] p-1 flex-shrink-0 transition-colors"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={onLogout}
          title="Sair"
          className="text-white/40 hover:text-red-400 p-1 flex-shrink-0 transition-colors"
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  );
}

/* ============================================================================
   LAYOUT
   Casca de navegação. Não conhece nenhuma página específica — recebe a view
   ativa, o callback de navegação, um topBar opcional (busca global + badges)
   e o conteúdo da página via children. A estrutura de menu (navGroups) vem
   por prop, com o padrão de Fase 1 importado de ./navConfig.js — isso evita
   acoplamento e mantém o ESLint (react-refresh/only-export-components) feliz,
   já que este arquivo passa a exportar só o componente Layout.

   theme / onToggleTheme: mecanismo de modo claro/escuro. A classe "dark" é
   aplicada no wrapper raiz — qualquer "dark:" adicionado em qualquer página,
   em qualquer fase futura, passa a responder ao toggle automaticamente sem
   precisar tocar neste arquivo de novo.

   IMPORTANTE: para o toggle funcionar (em vez de seguir a preferência do
   sistema operacional), o tailwind.config.js precisa ter darkMode: 'class'.
   Isso será confirmado/ajustado na integração com o App.jsx.

   padded: true (padrão) aplica padding e fundo padrão de página. Use
   padded={false} para páginas de canvas cheio, como o Pipeline/Kanban.
   ============================================================================ */
export function Layout({
  navGroups = defaultNavGroups,
  active,
  onNavigate,
  children,
  topBar,
  padded = true,
  userName,
  userRole,
  onLogout,
  theme = "light",
  onToggleTheme,
}) {
  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="flex h-screen overflow-hidden bg-[#F0F4F8] dark:bg-slate-900">
        <Sidebar
          navGroups={navGroups}
          active={active}
          onNavigate={onNavigate}
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {topBar && (
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              {topBar}
            </div>
          )}
          <main className={`flex-1 overflow-y-auto ${padded ? "p-6 bg-[#F0F4F8] dark:bg-slate-900" : ""}`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default Layout;
