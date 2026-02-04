import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <>
      <Helmet>
        <title>Terms of Use | RentFlow</title>
        <meta
          name="description"
          content="RentFlow's Terms of Use. Read our terms and conditions for using our property management and rent payment platform."
        />
        <link rel="canonical" href="https://www.payrentflow.com/terms" />
      </Helmet>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="container flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="RentFlow" className="w-12 h-12" />
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-primary">Rent</span>
                <span className="text-foreground">Flow</span>
              </h1>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-24 pb-16 px-4">
          <div className="container max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8 md:p-12">
              <h1 className="text-4xl font-bold mb-4">Terms of Use</h1>
              <p className="text-muted-foreground mb-8">
                Last updated: February 3, 2026
              </p>

              <div className="prose prose-slate max-w-none dark:prose-invert">
                <p className="text-muted-foreground mb-8">
                  Please read these Terms of Use carefully before using RentFlow's property management and rent payment platform. 
                  By accessing or using our service, you agree to be bound by these terms.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
                <p>
                  By creating an account, accessing, or using RentFlow ("Service"), you agree to comply with and be bound 
                  by these Terms of Use ("Terms"). If you do not agree to these Terms, you may not use our Service.
                </p>
                <p className="mt-4">
                  These Terms apply to all users of the Service, including landlords, property managers, tenants, and 
                  any other individuals who access or use the platform.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">2. Description of Service</h2>
                <p>
                  RentFlow is a cloud-based property management and rent payment platform that enables:
                </p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Online rent collection and payment processing</li>
                  <li>Property and unit management</li>
                  <li>Tenant management and communication</li>
                  <li>Automated statement generation and late fee calculations</li>
                  <li>Lease agreement creation and electronic signature processing</li>
                  <li>Payment tracking and financial reporting</li>
                </ul>
                <p className="mt-4">
                  We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, 
                  with or without notice.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">3. User Accounts and Responsibilities</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Account Creation</h3>
                <p>To use our Service, you must:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Be at least 18 years of age</li>
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and update your account information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized access</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Account Security</h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials and for all 
                  activities that occur under your account. You agree to immediately notify us of any unauthorized 
                  use of your account.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.3 User Responsibilities</h3>
                <p>You agree to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Use the Service only for lawful purposes</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Provide accurate and truthful information</li>
                  <li>Respect the rights of other users</li>
                  <li>Not interfere with or disrupt the Service</li>
                  <li>Not attempt to gain unauthorized access to the Service</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">4. Payment Processing and Fees</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Payment Processing</h3>
                <p>
                  Rent payments are processed through Stripe, our third-party payment processor. By using our payment 
                  services, you agree to Stripe's terms of service and privacy policy. We are not responsible for 
                  Stripe's services or any issues arising from payment processing.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Processing Fees</h3>
                <p>Payment processing fees apply as follows:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li><strong>Credit/Debit Card Payments:</strong> 3.75% of the payment amount</li>
                  <li><strong>ACH Bank Transfers:</strong> $5.00 flat fee per transaction</li>
                </ul>
                <p>
                  Fees are clearly displayed before payment completion. Fees are non-refundable except as required by law.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Payment Authorization</h3>
                <p>
                  By initiating a payment, you authorize us and our payment processor to charge your payment method 
                  for the specified amount plus applicable fees. You are responsible for ensuring sufficient funds 
                  are available.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">4.4 Refunds and Disputes</h3>
                <p>
                  Refund requests must be handled between landlords and tenants. RentFlow facilitates payments but 
                  does not mediate payment disputes. Processing fees are generally non-refundable.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">5. Property Management Services</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">5.1 Landlord Responsibilities</h3>
                <p>Landlords using our Service agree to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Provide accurate property and unit information</li>
                  <li>Comply with all applicable landlord-tenant laws</li>
                  <li>Maintain valid payment processing accounts (Stripe Connect)</li>
                  <li>Respond to tenant inquiries in a timely manner</li>
                  <li>Use lease agreements and documents in compliance with local laws</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">5.2 Tenant Responsibilities</h3>
                <p>Tenants using our Service agree to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Provide accurate personal and contact information</li>
                  <li>Make rent payments in accordance with lease agreements</li>
                  <li>Review and sign lease agreements as required</li>
                  <li>Notify landlords of any issues or concerns</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">5.3 Lease Agreements</h3>
                <p>
                  Lease agreements created through our platform are the responsibility of the parties involved. 
                  RentFlow provides tools for creating and signing leases but does not provide legal advice. 
                  We recommend consulting with legal counsel for lease agreements.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">6. Intellectual Property</h2>
                <p>
                  The Service, including all content, features, functionality, and software, is owned by RentFlow 
                  and is protected by copyright, trademark, and other intellectual property laws.
                </p>
                <p className="mt-4">
                  You are granted a limited, non-exclusive, non-transferable license to access and use the Service 
                  for its intended purpose. You may not:
                </p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Copy, modify, or create derivative works of the Service</li>
                  <li>Reverse engineer, decompile, or disassemble the Service</li>
                  <li>Remove any copyright or proprietary notices</li>
                  <li>Use the Service for any commercial purpose other than property management</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">7. Prohibited Uses</h2>
                <p>You agree not to use the Service to:</p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Transmit harmful, offensive, or illegal content</li>
                  <li>Engage in fraud, money laundering, or other illegal activities</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Attempt to gain unauthorized access to any part of the Service</li>
                  <li>Use automated systems to access the Service without permission</li>
                  <li>Impersonate any person or entity</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">8. Limitation of Liability</h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, RENTFLOW AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY 
                  INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO 
                  LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE.
                </p>
                <p className="mt-4">
                  Our total liability for any claims arising from or related to the Service shall not exceed the 
                  amount you paid us in the twelve (12) months preceding the claim, or $100, whichever is greater.
                </p>
                <p className="mt-4">
                  We do not guarantee that the Service will be uninterrupted, error-free, or secure. The Service 
                  is provided "as is" and "as available."
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">9. Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless RentFlow, its affiliates, officers, directors, 
                  employees, and agents from any claims, damages, losses, liabilities, and expenses (including 
                  attorneys' fees) arising out of or relating to:
                </p>
                <ul className="list-disc pl-6 space-y-2 my-4">
                  <li>Your use of the Service</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any rights of another party</li>
                  <li>Your violation of any applicable laws or regulations</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-8 mb-4">10. Termination</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">10.1 Termination by You</h3>
                <p>
                  You may terminate your account at any time by contacting us or using the account deletion feature 
                  in your settings. Upon termination, your access to the Service will cease, but we may retain your 
                  data as required by law or for legitimate business purposes.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">10.2 Termination by Us</h3>
                <p>
                  We may suspend or terminate your account immediately, without notice, if you violate these Terms, 
                  engage in fraudulent activity, or for any other reason we deem necessary to protect the Service 
                  or other users.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">10.3 Effect of Termination</h3>
                <p>
                  Upon termination, your right to use the Service will immediately cease. All provisions of these 
                  Terms that by their nature should survive termination shall survive, including ownership provisions, 
                  warranty disclaimers, and limitations of liability.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">11. Dispute Resolution</h2>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">11.1 Governing Law</h3>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the State of 
                  [Your State], United States, without regard to its conflict of law provisions.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">11.2 Arbitration</h3>
                <p>
                  Any dispute arising out of or relating to these Terms or the Service shall be resolved through 
                  binding arbitration in accordance with the rules of the American Arbitration Association. 
                  Arbitration shall take place in [Your City, State].
                </p>
                <p className="mt-4">
                  You waive your right to a jury trial and to participate in a class action lawsuit.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">12. Third-Party Services</h2>
                <p>
                  Our Service integrates with third-party services, including Stripe (payments), DocuSign (electronic 
                  signatures), and Resend (email delivery). Your use of these services is subject to their respective 
                  terms of service and privacy policies. We are not responsible for the availability, accuracy, or 
                  practices of third-party services.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">12.1 Electronic Signatures (DocuSign)</h3>
                <p>
                  Lease agreement signing is powered by DocuSign, Inc. When you connect your DocuSign account to RentFlow, 
                  send a document for signature, or sign a document through our platform, you are also subject to 
                  DocuSign's Terms of Service and Privacy Policy. By using our electronic signature features, you 
                  acknowledge that document content, signer names, email addresses, and related data will be processed 
                  by DocuSign to provide the service. We are not responsible for DocuSign's services, availability, 
                  security, or data practices. DocuSign's terms and policies are available at{" "}
                  <a href="https://www.docusign.com/company/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">docusign.com/company/terms-and-conditions</a> and{" "}
                  <a href="https://www.docusign.com/company/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">docusign.com/company/privacy-policy</a>.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">13. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. We will notify you of material changes by 
                  posting the updated Terms on this page and updating the "Last updated" date. Your continued use of 
                  the Service after such changes constitutes acceptance of the modified Terms.
                </p>
                <p className="mt-4">
                  If you do not agree to the modified Terms, you must stop using the Service and may terminate your account.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">14. Severability</h2>
                <p>
                  If any provision of these Terms is found to be unenforceable or invalid, that provision shall be 
                  limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in 
                  full force and effect.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">15. Entire Agreement</h2>
                <p>
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
                  RentFlow regarding the Service and supersede all prior agreements and understandings.
                </p>

                <h2 className="text-2xl font-semibold mt-8 mb-4">16. Contact Us</h2>
                <p>If you have questions about these Terms, please contact us:</p>
                <ul className="list-none space-y-2 my-4">
                  <li><strong>Email:</strong> legal@payrentflow.com</li>
                  <li><strong>Website:</strong> <Link to="/contact" className="text-primary hover:underline">Contact Us</Link></li>
                </ul>

                <div className="mt-8 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> These Terms of Use are provided for informational purposes and do not 
                    constitute legal advice. If you have specific legal questions, please consult with a qualified attorney.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-border">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="RentFlow" className="w-10 h-10" />
                <span className="font-semibold text-foreground">RentFlow</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link to="/contact" className="hover:text-foreground transition-colors">Support</Link>
              </div>
              <p className="text-sm text-muted-foreground">
                © 2026 RentFlow. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
