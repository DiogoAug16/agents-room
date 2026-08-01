import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && window.location.pathname === "/dev/asset-editor") void import("./dev/asset-editor").then(({ AssetEditor }) => root.render(<AssetEditor />));
else root.render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
