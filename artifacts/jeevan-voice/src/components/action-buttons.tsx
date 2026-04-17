import { Phone, MapPin, Navigation, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionItem } from "@workspace/api-client-react";

function buildUrl(action: ActionItem): string {
  switch (action.type) {
    case "call":
      return `tel:${action.phone || ""}`;
    case "map":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        action.query || "",
      )}`;
    case "directions":
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        action.destination || "",
      )}`;
    case "link":
      return action.url || "#";
    default:
      return "#";
  }
}

function getIcon(type: string) {
  switch (type) {
    case "call":
      return <Phone className="w-4 h-4" />;
    case "map":
      return <MapPin className="w-4 h-4" />;
    case "directions":
      return <Navigation className="w-4 h-4" />;
    case "link":
      return <ExternalLink className="w-4 h-4" />;
    default:
      return null;
  }
}

function getButtonStyle(type: string, isEmergency: boolean): string {
  if (isEmergency && type === "call") {
    return "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive";
  }
  if (type === "call") {
    return "bg-green-600 hover:bg-green-700 text-white border-green-600";
  }
  return "";
}

export function ActionButtons({
  actions,
  isEmergency = false,
}: {
  actions: ActionItem[];
  isEmergency?: boolean;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {actions.map((action, idx) => (
        <Button
          key={idx}
          asChild
          variant="outline"
          size="lg"
          className={`gap-2 rounded-full font-semibold ${getButtonStyle(
            action.type,
            isEmergency,
          )}`}
        >
          <a
            href={buildUrl(action)}
            target={action.type === "call" ? "_self" : "_blank"}
            rel="noopener noreferrer"
          >
            {getIcon(action.type)}
            {action.label}
          </a>
        </Button>
      ))}
    </div>
  );
}
