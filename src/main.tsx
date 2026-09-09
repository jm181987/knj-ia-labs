import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { installPaymentSecurity } from "@/lib/paymentSecurityBootstrap";

installPaymentSecurity();
createRoot(document.getElementById("root")!).render(<App />);
