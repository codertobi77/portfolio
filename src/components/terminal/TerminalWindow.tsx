import { cn } from "@/lib/utils";

interface TerminalWindowProps {
  title?: string;
  command?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "default" | "bordered";
}

/**
 * A terminal-style window: title bar with dots, optional command prompt,
 * and content rendered as terminal output.
 */
export function TerminalWindow({
  title = "amidala@samari: ~",
  command,
  children,
  className,
  variant = "default",
}: TerminalWindowProps) {
  return (
    <div
      className={cn(
        "relative border border-border bg-card shadow-[0_0_40px_oklch(0.78_0.19_149/8%)]",
        variant === "bordered" && "bg-background",
        className,
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="term-dot bg-terminal-red/80" />
        <span className="term-dot bg-terminal-amber/80" />
        <span className="term-dot bg-terminal-green/80" />
        <span className="ml-2 truncate text-xs text-terminal-dim">
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 text-sm leading-relaxed">
        {command && (
          <p className="mb-3 text-terminal-green">
            <span className="text-terminal-dim">amidala@samari</span>
            <span className="text-terminal-dim">:</span>
            <span className="text-terminal-cyan">~</span>
            <span className="text-terminal-dim">$ </span>
            {command}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
