// user-avatar.tsx — shared avatar that renders the user's real photo wherever
// their identity appears (sidebar, top bar, notifications, assignments).
// Falls back to initials when no photo is uploaded.
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function initialsFor(name?: string | null, email?: string | null): string {
  const src = name ?? email ?? "?";
  return src
    .split(/[.\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({
  name,
  email,
  url,
  className,
  fallbackClassName,
}: {
  name?: string | null;
  email?: string | null;
  url?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      {url && (
        <AvatarImage
          src={url}
          alt={name ?? email ?? "user"}
          className="object-cover"
          onError={(e) => {
            // Broken/revoked URL — drop to initials instead of an empty circle.
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <AvatarFallback className={cn("bg-primary/20 text-primary", fallbackClassName)}>
        {initialsFor(name, email) || "U"}
      </AvatarFallback>
    </Avatar>
  );
}
