import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function App() {
	const loc = useLocation();
	const path = loc.pathname || "/";
	return (
		<div className="container">
			<header className="header">
				<nav className="nav top-menu" aria-label="Navigazione principale">
					<Link className={path.startsWith("/analyze") ? "active" : ""} to="/analyze">
						Analizzatore
					</Link>
					<Link className={path === "/" ? "active" : ""} to="/">
						Compilatore
					</Link>
					<Link className={path.startsWith("/integrations") ? "active" : ""} to="/integrations">
						Integrazioni
					</Link>
				</nav>
			</header>
			<main className="main">
				<Outlet />
			</main>
		</div>
	);
}

