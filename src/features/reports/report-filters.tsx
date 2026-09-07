import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ReportFiltersProps {
  values: {
    month: string;
    year: string;
    section: string;
    stallNumber: string;
    vendorName: string;
    paymentStatus: string;
  };
  sections: string[];
  onChange: (field: "month" | "year" | "section" | "stallNumber" | "vendorName" | "paymentStatus", value: string) => void;
  onGenerate: () => void;
}

export function ReportFilters({ values, sections, onChange, onGenerate }: ReportFiltersProps) {
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Report filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Month</label>
            <Select onChange={(event) => onChange("month", event.target.value)} value={values.month}>
              <option>All months</option>
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleString("en", { month: "long" })}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Year</label>
            <Select onChange={(event) => onChange("year", event.target.value)} value={values.year}>
              <option>All years</option>
              {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index).map((year) => <option key={year}>{year}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Block</label>
            <Select onChange={(event) => onChange("section", event.target.value)} value={values.section}>
              <option>All blocks</option>
              {sections.map((section) => (
                <option key={section}>{section}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Stall number</label>
            <Input onChange={(event) => onChange("stallNumber", event.target.value)} placeholder="e.g. A-07" value={values.stallNumber} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Vendor name</label>
            <Input onChange={(event) => onChange("vendorName", event.target.value)} placeholder="First or last name" value={values.vendorName} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Payment status</label>
            <Select onChange={(event) => onChange("paymentStatus", event.target.value)} value={values.paymentStatus}>
              <option>Any status</option>
              <option>Pending</option>
              <option>Verified</option>
              <option>Rejected</option>
              <option>Voided</option>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <Button className="flex-1" onClick={onGenerate} type="button" variant="secondary">
              Generate report
            </Button>
            <Button onClick={() => window.print()} type="button" variant="outline">
              Print report
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
