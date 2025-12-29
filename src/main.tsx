import React from "react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { UserProvider } from "./contexts/UserContext";

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(
	<StrictMode>
		<UserProvider>
			<App />
		</UserProvider>
	</StrictMode>,
)
