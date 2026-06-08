import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const applicationSchema = z.object({
  businessType: z.string().min(2, "Business type is required."),
  preferredSection: z.string().min(2, "Choose a market section."),
  preferredStallType: z.string().min(2, "Choose a stall type."),
  notes: z.string().min(10, "Provide a short description of your trade."),
});

type ApplicationValues = z.infer<typeof applicationSchema>;

interface StallApplicationFormProps {
  initialValues?: Partial<ApplicationValues>;
  title?: string;
  description?: string;
  saveLabel?: string;
  submitLabel?: string;
  onSaveDraft: (values: ApplicationValues) => Promise<void> | void;
  onSubmitApplication?: (values: ApplicationValues) => Promise<void> | void;
  onDelete?: () => void;
}

const defaultValues: ApplicationValues = {
  businessType: "Native delicacies",
  preferredSection: "Dry Goods",
  preferredStallType: "General Merchandise",
  notes: "Selling native snacks, tablea, and local delicacies for daily walk-in buyers.",
};

export function StallApplicationForm({
  initialValues,
  title = "New stall application",
  description = "Prepare a draft, then submit the application when your details are complete.",
  saveLabel = "Save draft",
  submitLabel = "Submit application",
  onSaveDraft,
  onSubmitApplication,
  onDelete,
}: StallApplicationFormProps) {
  const form = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { ...defaultValues, ...initialValues },
  });

  useEffect(() => {
    form.reset({ ...defaultValues, ...initialValues });
  }, [form, initialValues]);

  const isSubmitting = form.formState.isSubmitting;
  const handleSaveDraft = form.handleSubmit(async (values) => {
    await onSaveDraft(values);
  });

  const handleSubmitApplication = form.handleSubmit(async (values) => {
    if (!onSubmitApplication) {
      return;
    }

    await onSubmitApplication(values);
  });

  return (
    <Card className="overflow-hidden border-0 shadow-none">
      <CardHeader className="bg-gradient-to-br from-[#0aa073] to-[#18b982] px-8 py-6 text-white">
        <CardTitle className="text-2xl text-white">{title}</CardTitle>
        <CardDescription className="font-semibold text-white/90">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-8 py-6">
        <form className="space-y-4" onSubmit={handleSaveDraft}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-800">Business type *</label>
              <Input placeholder="Select business type" {...form.register("businessType")} />
              <FieldError message={form.formState.errors.businessType?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-800">Preferred section *</label>
              <Select {...form.register("preferredSection")}>
                <option>Dry Goods</option>
                <option>Wet Market</option>
                <option>Vegetables</option>
                <option>Fish Aisle</option>
              </Select>
              <FieldError message={form.formState.errors.preferredSection?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-800">Stall preference *</label>
              <Select {...form.register("preferredStallType")}>
                <option>General Merchandise</option>
                <option>Fish</option>
                <option>Meat</option>
                <option>Produce</option>
              </Select>
              <FieldError message={form.formState.errors.preferredStallType?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-800">Additional information</label>
            <Textarea
              placeholder="Tell us more about your business and why you'd like to rent a stall..."
              rows={4}
              {...form.register("notes")}
            />
            <FieldError message={form.formState.errors.notes?.message} />
          </div>

          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <Button className="bg-[#00966f] uppercase hover:bg-[#00825f]" disabled={isSubmitting} type="submit">
              {saveLabel}
            </Button>
            {onSubmitApplication ? (
              <Button
                className="bg-[#00966f] uppercase hover:bg-[#00825f]"
                disabled={isSubmitting}
                onClick={handleSubmitApplication}
                type="button"
              >
                {submitLabel}
              </Button>
            ) : null}
            {onDelete ? (
              <Button className="sm:col-span-2" disabled={isSubmitting} onClick={onDelete} type="button" variant="destructive">
                Delete draft
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}
