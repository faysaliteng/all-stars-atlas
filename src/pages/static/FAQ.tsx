import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  { q: "How do I book a flight on Seven Trip?", a: "Simply go to our homepage, select the Flight tab, enter your origin, destination, dates, and number of passengers, then click Search. You'll see available flights with prices. Select your preferred flight and follow the booking steps to complete your reservation." },
  { q: "What payment methods do you accept?", a: "We accept bKash, Nagad, Rocket, Visa/MasterCard, AMEX, bank transfers, and cheque payments. For bank transfers, you'll need to upload a receipt for verification." },
  { q: "Can I cancel or modify my booking?", a: "Yes, you can request cancellations or modifications from your Dashboard → My Bookings. Cancellation and modification fees depend on the airline/hotel policy. Some fares are non-refundable." },
  { q: "How do I apply for a visa through Seven Trip?", a: "Go to the Visa section, select your destination country, fill in the application form with your travel details and personal information, upload required documents, and submit. Our team will process your application and keep you updated." },
  { q: "Is my payment information secure?", a: "Absolutely. We use industry-standard SSL encryption and never store your credit card details on our servers. All transactions are processed through certified payment gateways." },
  { q: "What is an eSIM and how does it work?", a: "An eSIM is a digital SIM card that lets you activate a cellular plan without a physical SIM. After purchase, you'll receive a QR code via email. Simply scan it with your eSIM-compatible phone to activate data in your destination country." },
  { q: "How can I contact customer support?", a: "You can reach us 24/7 via phone at +880 1234-567890, email at support@seventrip.com.bd, or through the Contact page on our website. We typically respond within 1 hour." },
  { q: "Do you offer group booking discounts?", a: "Yes, we offer special rates for group bookings of 10 or more passengers. Contact our group bookings team at groups@seventrip.com.bd for a custom quote." },
  { q: "How do I get my e-ticket after booking?", a: "After your booking is confirmed and payment is verified, your e-ticket will be available in your Dashboard → E-Tickets section. You can download it as a PDF or have it emailed to you." },
  { q: "What is your refund policy?", a: "Refund policies vary by service. Flights follow the airline's cancellation policy. Hotels typically allow free cancellation up to 24-48 hours before check-in. Full details are available on our Refund Policy page." },
];

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-muted/30">
      <section className="relative bg-gradient-to-br from-[hsl(217,91%,50%)] to-[hsl(224,70%,28%)] pt-24 lg:pt-32 pb-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">Frequently Asked Questions</h1>
          <p className="text-white/60 text-sm sm:text-base max-w-lg mx-auto">Find quick answers to common questions about our services</p>
        </div>
      </section>

      <section className="py-10 sm:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Card key={i} className="overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-bold pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && (
                  <CardContent className="pt-0 pb-5 px-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;
