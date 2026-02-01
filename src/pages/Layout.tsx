import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

type LayoutProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { to: "/recommendations", label: "Matches" },
  { to: "/friends", label: "Friends" },
  { to: "/profile", label: "Profile" },
  { to: "/messages", label: "Message" },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const EXACT_ROUTES = ["/recommendations", "/friends", "/profile"];
  const PREFIX_ROUTES = ["/messages"];

  const showNavLinks =
    EXACT_ROUTES.includes(location.pathname) ||
    PREFIX_ROUTES.some((base) => location.pathname.startsWith(base));

  
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="navbar">
        <div className="navbar__inner">
          {showNavLinks ? (
            <NavLink to="/recommendations" className="navbar__logo">
              FRENDIT
            </NavLink>
          ) : (
            <div className="navbar__logo">FRENDIT</div>
          )}

          {showNavLinks && (
            <>
              
              <nav className="navbar__links navbar__links--desktop">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      "navbar__link" +
                      (isActive ? " navbar__link--active" : "")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

             
              <button
                type="button"
                className={
                  "navbar__burger" +
                  (isMobileMenuOpen ? " navbar__burger--open" : "")
                }
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <span />
                <span />
                <span />
              </button>
            </>
          )}
        </div>
      </header>

      
      {showNavLinks && isMobileMenuOpen && (
        <nav className="navbar__mobile-menu">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                "navbar__mobile-link" +
                (isActive ? " navbar__mobile-link--active" : "")
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="main-content">{children}</main>
    </div>
  );
}



