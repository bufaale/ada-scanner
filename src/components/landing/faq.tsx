import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "What is WCAG 2.1?",
    answer:
      "Web Content Accessibility Guidelines (WCAG) 2.1 is a set of international standards developed by the W3C to make web content accessible to people with disabilities. It includes three levels of conformance: A (minimum), AA (mid-range), and AAA (highest). Most legal requirements reference WCAG 2.1 Level AA compliance.",
  },
  {
    question: "What WCAG levels do you check?",
    answer:
      "We check all three levels (A, AA, AAA) in every scan. Our reports break down compliance scores by level, so you can see exactly where your site stands against different standards and legal requirements.",
  },
  {
    question: "What's the difference between Quick and Deep scan?",
    answer:
      "Quick scans analyze a single page in under 60 seconds — perfect for spot checks. Deep scans crawl up to 10 pages to find issues across your entire site, providing comprehensive coverage and insights into site-wide patterns.",
  },
  {
    question: "Do you provide fix suggestions?",
    answer:
      "Yes, Pro and Agency plans include AI-powered code fix suggestions for every issue. Claude AI analyzes your HTML and provides specific, actionable recommendations you can implement immediately.",
  },
  {
    question: "Can I export reports?",
    answer:
      "Yes, Pro and Agency plans can download PDF compliance reports with detailed scores, issue breakdowns, and fix suggestions. Agency plans include white-label options to add your branding.",
  },
  {
    question: "How does billing work?",
    answer:
      "We offer monthly and yearly plans with clear scan limits. Free tier includes 2 scans/month. Pro includes 30 scans/month. Agency includes unlimited scans. You can upgrade, downgrade, or cancel at any time.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Frequently asked questions</h2>
          <p className="text-muted-foreground mt-4 mx-auto max-w-2xl">
            Everything you need to know about ADA Scanner.
          </p>
        </div>
        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
