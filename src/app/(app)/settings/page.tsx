import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { getOrgSettings } from "@/features/org/queries";
import { SettingsForm } from "@/features/org/settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Org settings, behind company.settings (G2/G10) — the authoritative guard is
// here, same as the (app) layout guards auth; the sidebar only hides the link
// as a UX nicety. The logo upload lands here later (image files only, D17).
export default async function SettingsPage() {
  const actor = requireCapability(await requireActor(), "company.settings");
  const settings = await getOrgSettings(actor);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your business identity and the defaults new clients and invoices start
          from.
        </p>
      </div>

      <SettingsForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Uploading a company logo (image files only) for the invoice header
            will be configurable here in a later update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
