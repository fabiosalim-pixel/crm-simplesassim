import { Shield, LogOut, Moon, Sun } from "lucide-react";
import { navGroups as defaultNavGroups } from "./navConfig";

function Sidebar({ navGroups, active, onNavigate, userName, userRole, onLogout, theme, onToggleTheme }) {
  return (
    <nav className="w-[225px] bg-sidebar dark:bg-sidebar-dark flex flex-col flex-shrink-0 h-full">
      {/* Marca */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-marca-gold flex items-center justify-center flex-shrink-0">
            <Shield size={19} className="text-marca-navy" />
          </div>
          <div className="min-w-0">
            <div className="text-marca-gold font-extrabold text-[15px] leading-none truncate">
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
                      ? "bg-marca-gold/[0.13] text-marca-gold font-bold border-marca-gold"
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
        <div className="w-8 h-8 rounded-full bg-marca-gold flex items-center justify-center font-extrabold text-marca-navy text-[13px] flex-shrink-0">
          {(userName || "A")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white text-[11px] font-bold truncate">{userName || "Administrador"}</div>
          <div className="text-white/35 text-[10px] truncate">{userRole || "Corretor"}</div>
        </div>
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className="text-white/40 hover:text-marca-gold p-1 flex-shrink-0 transition-colors"
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
   Casca de navegação. Recebe a view ativa, o callback de navegação, um topBar
   opcional (busca global + badges) e o conteúdo da página via children. A
   estrutura de menu (navGroups) vem por prop, com o padrão de Fase 1 importado
   de ./navConfig.js.

   Sistema de cor: usa os tokens nomeados do tailwind.config.js (canvas, painel,
   sidebar, borda), cada um com par claro/escuro embutido. A classe "dark" no
   wrapper raiz alterna os dois. Trocar o tom da aplicação inteira é editar o
   config, não caçar hex em cada arquivo.

   padded: true (padrão) aplica padding e fundo de canvas. Use padded={false}
   para páginas de canvas cheio, como o Pipeline/Kanban.
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
      <div className="flex h-screen overflow-hidden bg-canvas dark:bg-canvas-dark">
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
            <div className="bg-painel dark:bg-painel-dark border-b border-borda dark:border-borda-dark flex-shrink-0">
              {topBar}
            </div>
          )}
          <main className={`flex-1 overflow-y-auto ${padded ? "p-6 bg-canvas dark:bg-canvas-dark" : ""}`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default Layout;
