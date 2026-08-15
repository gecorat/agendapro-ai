import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending: { icon: Loader2, text: "Pendiente", className: "text-muted-foreground animate-spin" },
  running: { icon: Loader2, text: "Ejecutando", className: "text-muted-foreground animate-spin" },
  in_progress: { icon: Loader2, text: "En progreso", className: "text-muted-foreground animate-spin" },
  completed: { icon: CheckCircle2, text: "Completado", className: "text-emerald-600" },
  success: { icon: CheckCircle2, text: "Completado", className: "text-emerald-600" },
  failed: { icon: AlertCircle, text: "Falló", className: "text-destructive" },
  error: { icon: AlertCircle, text: "Error", className: "text-destructive" },
};

function formatLabel(name) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);

  const status = toolCall.status || "pending";
  const results = toolCall.results;
  let parsedResults = results;
  if (typeof results === "string") {
    try {
      parsedResults = JSON.parse(results);
    } catch {
      parsedResults = results;
    }
  }

  // Detect failure
  const isFailed =
    status === "failed" ||
    status === "error" ||
    (typeof parsedResults === "string" && /error|failed/i.test(parsedResults)) ||
    (parsedResults && typeof parsedResults === "object" && parsedResults.success === false);

  const effectiveStatus = isFailed ? "failed" : status;
  const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  // display_projection handling
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;
  const label = formatLabel(toolCall.name || "Herramienta");
  const stateLabel = isFailed
    ? proj.error_label || statusCfg.text
    : ["pending", "running", "in_progress"].includes(effectiveStatus)
    ? proj.active_label || statusCfg.text
    : proj.label || statusCfg.text;

  let parsedArgs = toolCall.arguments_string;
  if (typeof toolCall.arguments_string === "string") {
    try {
      parsedArgs = JSON.parse(toolCall.arguments_string);
    } catch {
      // keep raw
    }
  }

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 w-full text-left",
          !hideDetails && "hover:bg-muted cursor-pointer"
        )}
      >
        {!hideDetails &&
          (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        <Wrench className="w-3 h-3 text-muted-foreground" />
        <span className="font-medium">{proj.label || label}</span>
        <StatusIcon className={cn("w-3 h-3 ml-auto", statusCfg.className)} />
        <span className={statusCfg.className}>{stateLabel}</span>
      </button>
      {!hideDetails && expanded && (
        <div className="mt-1.5 space-y-2 rounded-md bg-muted/40 p-2">
          {parsedArgs !== undefined && (
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Parámetros:</p>
              <pre className="whitespace-pre-wrap break-words text-[11px] font-mono">
                {typeof parsedArgs === "string" ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
          {parsedResults !== undefined && parsedResults !== null && (
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Resultado:</p>
              <pre className="whitespace-pre-wrap break-words text-[11px] font-mono">
                {typeof parsedResults === "string"
                  ? parsedResults
                  : JSON.stringify(parsedResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}