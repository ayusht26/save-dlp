import React from "react";
import { motion } from "framer-motion";
import { Cpu, AlertTriangle } from "lucide-react";

export default function BackendStatus({ isError, onRetry }) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="p-4 bg-[var(--red-dim)] rounded-full text-[var(--red)] border border-red-500/20">
          <AlertTriangle size={32} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            Engine Connection Failed
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Could not connect to the local yt-dlp backend.
          </p>
        </div>
        <button className="fetch-btn mt-2" onClick={onRetry}>
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="relative"
      >
        <div className="absolute inset-0 bg-[var(--red)] blur-xl opacity-20 rounded-full"></div>
        <div className="relative p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl text-[var(--red)]">
          <Cpu size={32} />
        </div>
      </motion.div>
      <div className="flex flex-col items-center">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Waking up Engine...
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 animate-pulse">
          Connecting to internal API
        </p>
      </div>
    </div>
  );
}
