import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Globe2,
  Trash2,
} from "lucide-react";

export default function DomainItemCard({ item, dns, remove, loadDns }: any) {

  return (
    <div
      key={item.id}
      className="flex flex-col gap-3 rounded-3xl bg-white p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
          <Globe2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">
            {item.hostname}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={item.status === "active" ? "success" : "secondary"}>
              {item.status}
            </Badge>
            {item.routingEnabled && <Badge variant="outline">routing</Badge>}
            {item.sendingEnabled && <Badge variant="outline">sending</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadDns(item.id)}>
            Details
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => remove.mutate(item.id)}
            disabled={remove.isPending}
            aria-label={`Remove ${item.hostname}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-neutral-500">DNS and mailbox delivery are managed by your email provider.</p>
    </div>
  );
}
