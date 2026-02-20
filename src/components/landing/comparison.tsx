import { Check, X, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type CellValue = true | false | string;

interface ComparisonRow {
  feature: string;
  accessiscan: CellValue;
  accessibe: CellValue;
  siteimprove: CellValue;
  deque: CellValue;
}

const comparisonData: ComparisonRow[] = [
  {
    feature: "Starting Price",
    accessiscan: "$19/mo",
    accessibe: "$49/mo",
    siteimprove: "~$1,250/mo",
    deque: "~$2,250/mo",
  },
  {
    feature: "AI Fix Code Generation",
    accessiscan: true,
    accessibe: false,
    siteimprove: "Partial",
    deque: false,
  },
  {
    feature: "Source Code Analysis",
    accessiscan: true,
    accessibe: false,
    siteimprove: true,
    deque: true,
  },
  {
    feature: "WCAG 2.1 A/AA/AAA",
    accessiscan: true,
    accessibe: "A/AA only",
    siteimprove: true,
    deque: true,
  },
  {
    feature: "PDF Compliance Reports",
    accessiscan: true,
    accessibe: false,
    siteimprove: true,
    deque: false,
  },
  {
    feature: "Free Tier",
    accessiscan: true,
    accessibe: false,
    siteimprove: false,
    deque: "Extension only",
  },
  {
    feature: "No Per-User Pricing",
    accessiscan: true,
    accessibe: true,
    siteimprove: false,
    deque: false,
  },
  {
    feature: "Not an Overlay",
    accessiscan: true,
    accessibe: false,
    siteimprove: true,
    deque: true,
  },
  {
    feature: "Self-Service Signup",
    accessiscan: true,
    accessibe: true,
    siteimprove: false,
    deque: false,
  },
  {
    feature: "No Annual Contract",
    accessiscan: true,
    accessibe: true,
    siteimprove: false,
    deque: false,
  },
];

function CellContent({ value }: { value: CellValue }) {
  if (value === true) {
    return <Check className="mx-auto h-5 w-5 text-green-600" />;
  }
  if (value === false) {
    return <X className="mx-auto h-5 w-5 text-red-400" />;
  }
  return (
    <span className="text-sm text-muted-foreground">{value}</span>
  );
}

export function Comparison() {
  return (
    <section className="bg-muted/40 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold">
            How we compare
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Real source-code scanning at a fraction of the cost — without the legal
            risk of overlays.
          </p>
        </div>
        <div className="mt-12 overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Feature</TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-primary">AccessiScan</span>
                    <Badge variant="secondary" className="text-xs">You are here</Badge>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>accessiBe</span>
                    <span className="text-xs font-normal text-muted-foreground">Overlay</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Siteimprove</span>
                    <span className="text-xs font-normal text-muted-foreground">Enterprise</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Deque axe</span>
                    <span className="text-xs font-normal text-muted-foreground">Enterprise</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonData.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium">{row.feature}</TableCell>
                  <TableCell className="bg-primary/5 text-center">
                    <CellContent value={row.accessiscan} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CellContent value={row.accessibe} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CellContent value={row.siteimprove} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CellContent value={row.deque} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
