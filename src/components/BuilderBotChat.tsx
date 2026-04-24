import { useEffect } from "react";

declare global {
  interface Window {
    BuilderBotChat?: {
      init: (options: {
        id: string;
        companyName: string;
        avatarInitials: string;
        locale?: "es" | "en" | "pt";
        theme?: unknown;
      }) => Promise<unknown>;
      _clearGlobalInstance?: () => void;
    };
    __builderBotScriptPromise?: Promise<void>;
  }
}

const BUILDERBOT_SCRIPT_ID = "builderbot-sdk";
const BUILDERBOT_SCRIPT_SRC = "https://cdn.builderbot.cloud/sdk.umd.js";

const builderBotTheme = {
  colors: {
    primary: "#3B82F6",
    accent: "#3B82F6",
    sendButton: "#3B82F6",
    sendButtonHover: "#2563EB",
    text: "#F2F2F2",
    textSecondary: "#A6ADB8",
    background: "#1E1F22",
    backgroundChat: "#24272B",
    userMessageBg: "rgba(59,130,246,0.15)",
    userMessageText: "#93C5FD",
    agentMessageBg: "#2A2E33",
    agentMessageText: "#F2F2F2",
    border: "#32363C",
    hover: "rgba(59,130,246,0.12)",
    timestamp: "#6B7280",
    icon: "#A6ADB8",
    inputBackground: "#202225",
    inputPlaceholder: "#6B7280",
  },
  spacing: {
    borderRadius: "12px",
    messageBorderRadius: "8px",
  },
};

const removeExistingWidget = () => {
  window.BuilderBotChat?._clearGlobalInstance?.();

  document.querySelectorAll(".chat-widget-container, .chat-widget-button").forEach((node) => {
    node.remove();
  });
};

const loadBuilderBotScript = async () => {
  if (window.BuilderBotChat) return;

  if (!window.__builderBotScriptPromise) {
    window.__builderBotScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(BUILDERBOT_SCRIPT_ID) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar BuilderBot")), { once: true });

        if (window.BuilderBotChat) {
          resolve();
        }

        return;
      }

      const script = document.createElement("script");
      script.id = BUILDERBOT_SCRIPT_ID;
      script.src = BUILDERBOT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar BuilderBot"));
      document.body.appendChild(script);
    });
  }

  await window.__builderBotScriptPromise;
};

export function BuilderBotChat() {
  useEffect(() => {
    let disposed = false;

    const mountChat = async () => {
      try {
        await loadBuilderBotScript();
        if (disposed || !window.BuilderBotChat?.init) return;

        removeExistingWidget();

        await window.BuilderBotChat.init({
          id: "cd2b68f1-217a-40c0-8032-b501a80666e4",
          companyName: "KNJ PRO",
          avatarInitials: "IA",
          locale: "es",
          theme: builderBotTheme,
        });
      } catch (error) {
        console.error("[BuilderBot] error al inicializar el chat", error);
      }
    };

    mountChat();

    return () => {
      disposed = true;
      removeExistingWidget();
    };
  }, []);

  return null;
}